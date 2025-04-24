import os
import sys
import time
import random
import tiktoken
import json
import logging
import hashlib
import nest_asyncio
import pandas as pd
import dtale
from threading import BoundedSemaphore
from typing import Dict, Tuple, Literal
from dotenv import load_dotenv
from functools import lru_cache
from sqlalchemy import create_engine, inspect, text, MetaData
from langchain.chains import LLMChain
from langchain.memory import ConversationBufferMemory
from langchain.prompts import PromptTemplate
from langchain_core.runnables import Runnable
from langchain.docstore.document import Document
import faiss
from langchain.vectorstores.faiss import FAISS
from langchain.docstore import InMemoryDocstore
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.chains.summarize import load_summarize_chain
from langchain.schema import Document
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.llms import HuggingFaceHub
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from db_connection import DBConnection
# from buildvector import build_vector_index, build_history_vector_index


# ---------------------- INIT ----------------------
load_dotenv()
nest_asyncio.apply()

# ---------------------- Logging ----------------------
logging.basicConfig(filename="query_audit.json", level=logging.INFO, format='%(message)s')

def log_event(event_type, data):
    logging.info(json.dumps({"event": event_type, "data": data}))

# ---------------------- Config ----------------------
INDEX_FOLDER = "schema_index"
HISTORY_INDEX_FOLDER = "history_index"
embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
huggingface_api_token = os.getenv('HUGGINGFACEHUB_API_TOKEN')

# Optional: HuggingFace summarization model (skip if not summarizing)
summarizer_llm = HuggingFaceHub(
    repo_id="google/pegasus-xsum",  # You can change this to any summarization model
    model_kwargs={"temperature": 0.3, "max_length": 256},
    huggingfacehub_api_token=huggingface_api_token
)

# ---------------------- Memory Management ----------------------
user_memories = {}

# @lru_cache(maxsize=100)
def get_memory_for_session(session_id: str):
    if session_id not in user_memories:
        user_memories[session_id] = ConversationBufferMemory(memory_key="chat_history", return_messages=True)
    return user_memories[session_id]

# ---------------------- SQL Sanitizer (Stub) ----------------------
def sanitize_sql(sql: str) -> str:
    return sql.strip()

# ---------------------- Query Cache ----------------------
@lru_cache(maxsize=100)
def get_query_hash(query: str) -> str:
    return hashlib.md5(query.encode()).hexdigest()

query_cache = {}

# ---------------------- Rate Limiter ----------------------
# semaphore = BoundedSemaphore(value=1)
semaphore = BoundedSemaphore(value=os.cpu_count() or 4)

# ---------------------- DB Agent ----------------------
class DBExpertAgent:
    def __init__(self, engine):
        self.engine = engine.get_engine()
        self.dialect = self.engine.url.get_backend_name()
        self.db_name = self.engine.url.database.split('/')[-1]

        self.vectorstore = None
        self.history_vectorstore = None

        self.schema_info = self._extract_schema()
        self._build_vector_index()
        self._build_history_vector_index()

    def _extract_schema(self):
        inspector = inspect(self.engine)
        metadata = MetaData()
        metadata.reflect(bind=self.engine)

        schema = {self.db_name: {}}
        for table_name, table in metadata.tables.items():
            schema[self.db_name][table_name] = {'columns': {}}
            for column in table.columns:
                col_info = {
                    'type': str(column.type),
                    'primary_key': column.primary_key,
                    'nullable': column.nullable,
                    'default': str(column.default.arg) if column.default is not None else None,
                    'foreign_key': None
                }
                if column.foreign_keys:
                    fk = list(column.foreign_keys)[0]
                    col_info['foreign_key'] = str(fk.target_fullname)
                schema[self.db_name][table_name]['columns'][column.name] = col_info
        return schema

    def _build_vector_index(self):
        if not os.path.exists(INDEX_FOLDER):
            docs = []

            for schema_name, tables in self.schema_info.items():
                for table_name, table_info in tables.items():
                    lines = []
                    for col_name, col_attrs in table_info.get("columns", {}).items():
                        line = f"{col_name} ({col_attrs['type']})"
                        if col_attrs.get('primary_key'):
                            line += " [PK]"
                        if col_attrs.get('foreign_key'):
                            line += f" [FK → {col_attrs['foreign_key']}]"
                        lines.append(line)

                    table_doc = f"Schema: {schema_name}\nTable: {table_name}\nColumns:\n" + "\n".join(lines)
                    docs.append(Document(page_content=table_doc))

            splitter = RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=50)
            chunks = splitter.split_documents(docs)

            self.vectorstore = FAISS.from_documents(chunks, embedding_model)
            self.vectorstore.save_local(INDEX_FOLDER)
        else:
            self.vectorstore = FAISS.load_local(INDEX_FOLDER, embedding_model, allow_dangerous_deserialization=True)

    def _build_history_vector_index(self):
        history_index_path = os.path.join(HISTORY_INDEX_FOLDER)
        index_file_path = os.path.join(history_index_path, "index.faiss")

        if os.path.exists(index_file_path):
            self.history_vectorstore = FAISS.load_local(
                history_index_path,
                embeddings=embedding_model,
                allow_dangerous_deserialization=True
            )
        else:
            os.makedirs(history_index_path, exist_ok=True)

            # Create dummy document to initialize
            dummy_doc = [Document(page_content="hello")]
            self.history_vectorstore = FAISS.from_documents(dummy_doc, embedding_model)
            self.history_vectorstore.docstore = InMemoryDocstore()
            self.history_vectorstore.index_to_docstore_id = {}

            # Clear dummy doc entry from memory
            self.history_vectorstore.index.reset()
            self.history_vectorstore.docstore._dict.clear()
            self.history_vectorstore.index_to_docstore_id.clear()

            self.history_vectorstore.save_local(history_index_path)

    def _vectorize_history(self, memory, summarize_threshold: int = 20, enable_summarization: bool = True):
        """
        Vectorizes meaningful chat history messages and updates the FAISS-based history index.

        Parameters:
        - memory: ConversationBufferMemory or any object containing .chat_memory.messages
        - summarize_threshold (int): Max number of messages before summarization is triggered
        - enable_summarization (bool): Whether to summarize long chat history before indexing

        This function:
        - Filters out trivial or short messages (e.g., "okay", "thanks")
        - Optionally summarizes if chat history is long
        - Splits content into vector chunks
        - Updates and saves the history FAISS vectorstore
        """
        messages = memory.chat_memory.messages
        if not messages:
            return

        def is_meaningful(content: str) -> bool:
            content = content.lower().strip()
            return (
                len(content) > 20 and
                not any(content.startswith(phrase) for phrase in [
                    "hi", "hello", "thanks", "thank you", "okay", "got it", "sure", "no problem"
                ]) and
                content not in {"yes", "no", "ok", "cool", "great", "fine"}
            )

        # Filter for useful content
        meaningful_docs = [
            Document(page_content=m.content.strip())
            for m in messages
            if m.content and is_meaningful(m.content)
        ]

        if not meaningful_docs:
            return

        # Optional summarization for long history
        if enable_summarization and len(meaningful_docs) > summarize_threshold:
            splitter = RecursiveCharacterTextSplitter(chunk_size=1024, chunk_overlap=50)
            chunks = splitter.split_documents(meaningful_docs)
            summarize_chain = load_summarize_chain(summarizer_llm, chain_type="map_reduce") #chain_type="stuff" is directly pass history
            summary = summarize_chain.run(chunks)
            meaningful_docs = [Document(page_content=summary.strip())]

        # Final chunking before vectorization
        splitter = RecursiveCharacterTextSplitter(chunk_size=512, chunk_overlap=50)
        chunks = splitter.split_documents(meaningful_docs)

        self.history_vectorstore.add_documents(chunks)
        self.history_vectorstore.save_local(HISTORY_INDEX_FOLDER)

    def _get_relevant_context(self, user_input: str, top_k: int = 3) -> str:
        relevant_docs = self.vectorstore.similarity_search(user_input, k=top_k)
        return "\n".join([doc.page_content for doc in relevant_docs])

    def _get_relevant_history(self, user_input: str, top_k: int = 3) -> str:
        relevant_docs = self.history_vectorstore.similarity_search(user_input, k=top_k)
        return "\n".join([doc.page_content for doc in relevant_docs])

    def generate_sql(self, user_input: str, memory) -> str:
        with semaphore:            
            context = self._get_relevant_context(user_input)
            self._vectorize_history(memory)
            history = self._get_relevant_history(user_input)
            prompt = f"""
            As an Expert SQL Developer, based on the schema and chat history, generate an optimized SQL query.

            Schema:
            {context}

            History:
            {history}

            Request:
            {user_input}

            Return only raw SQL query. No explanation.
            """
            response = sql_llm.invoke(prompt)
            memory.chat_memory.add_user_message(user_input)
            memory.chat_memory.add_ai_message(response.content)
            # return sanitize_sql(response.content.strip("```sql").strip("```").strip())
            return sanitize_sql(response.content.strip().removeprefix("```sql").removesuffix("```"))

    def run_query(self, sql_query: str) -> pd.DataFrame:
        try:
            with self.engine.connect() as conn:
                return pd.read_sql(text(sql_query), conn)
        except Exception as e:
            log_event("query_error", str(e))
            return pd.DataFrame({'Error': [str(e)]})

    def generate_coding_script(self, user_input: str, memory) -> str:
        with semaphore:
            context = self._get_relevant_context(user_input)
            self._vectorize_history(memory)
            history = self._get_relevant_history(user_input)
            prompt = f"""
                You are a highly experienced senior software engineer.

                Your task is to generate a complete, production-quality script based on:
                - the user's request
                - any relevant schema
                - prior chat history (if applicable)
                ---
                ### 🧾 User Request:
                {user_input}

                ---
                ### 🧬 Relevant Schema or Context:
                If the schema is relevant to the request, use it. If not, rely on chat history.
                {context}

                ---
                ### 💬 Chat History:
                {history}

                ---
                ### ✅ Code Guidelines:
                - Follow **PEP8 and pylint** standards.
                - Use **clear comments and docstrings** for each function or class.
                - Choose **descriptive, self-explanatory variable names**.
                - Ensure **code modularity**, readability, and maintainability.
                - Do **not** include explanations outside code (generate **only code**).

                """

            response = code_llm.invoke(prompt)
            memory.chat_memory.add_user_message(user_input)
            memory.chat_memory.add_ai_message(response.content)
            return response.content

    def generate_er_diagram_description(self, user_input: str, memory) -> str:
        with semaphore:
            context = self._get_relevant_context(user_input)
            self._vectorize_history(memory)
            history = self._get_relevant_history(user_input)
            prompt = f"""
            You are a professional data architect. Based on provided schema, describe the Entity-Relationship Diagram (ERD) in short. without any discription of tables.

            Schema:
            {context}

            Request:
            {user_input}
            """
            response = code_llm.invoke(prompt)
            memory.chat_memory.add_user_message(user_input)
            memory.chat_memory.add_ai_message(response.content)
            return response.content

    def explain_data(self, df: pd.DataFrame) -> str:
        if df.empty:
            return "No data available."
        with semaphore:
            prompt = f"As a senior data analyst, explain the following data table:\n{df.head().to_string(index=False)}"
            return code_llm.invoke(prompt).content

    def visualize_data(self, df: pd.DataFrame):
        if not df.empty:
            dtale.show(df).open_browser()

class SafeLLMWrapper(Runnable):
    def __init__(self, llm, retries=3, delay_base=2, jitter=True):
        self.llm = llm
        self.retries = retries
        self.delay_base = delay_base
        self.jitter = jitter

    def invoke(self, input, config=None, **kwargs):
        for attempt in range(self.retries):
            try:
                return self.llm.invoke(input, config=config, **kwargs)
            except Exception as e:
                if "429" in str(e) or "quota" in str(e).lower():
                    wait_time = self.delay_base ** attempt
                    if self.jitter:
                        wait_time += random.uniform(0, 1)
                    print(f"⚠️ Retry in {wait_time:.1f}s (Attempt {attempt+1}/{self.retries})...")
                    time.sleep(wait_time)
                else:
                    raise
        raise RuntimeError("LLM quota exhausted or API call failed after retries.")

    def __getattr__(self, name):
        return getattr(self.llm, name)

def initialize_llm(
        provider: Literal["groq", "openai", "google"],
        model_name: str,
        temperature: float = 0,
        safe: bool = False
    ):
    """
    Initialize a language model, optionally wrapped with SafeLLMWrapper.

    Args:
        provider: The LLM provider.
        model_name: Model name.
        temperature: LLM temperature.
        safe: If True, returns a safe wrapper around the LLM.

    Returns:
        Either the raw LLM or a safe LLM wrapper.
    """
    if provider == "groq":
        llm = ChatGroq(model=model_name, temperature=temperature)
    elif provider == "openai":
        llm = ChatOpenAI(model=model_name, temperature=temperature)
    elif provider == "google":
        llm = ChatGoogleGenerativeAI(model=model_name, temperature=temperature)
    else:
        raise ValueError(f"Unsupported provider: {provider}")

    return SafeLLMWrapper(llm) if safe else llm
    # return llm

# --------- CHANGE THIS TO SWITCH LLM PROVIDER ---------
conversational_llm = initialize_llm(provider="google", model_name="gemini-2.0-flash-lite", safe=True)
sql_llm = initialize_llm(provider="groq", model_name="llama3-70b-8192", safe=True)
code_llm = initialize_llm(provider="groq", model_name="llama-3.3-70b-versatile", safe=True)

# ---------------------- Intent Classifier ----------------------
INTENT_PROMPT = PromptTemplate.from_template(
    """
    You are an intent classifier. Classify the input intent into one of these categories:
    - SQL_ANALYSIS
    - CODE_SCRIPTING
    - DB_KNOWLEDGE
    - GENERAL

    Examples:
    "Get total load per substation" -> SQL_ANALYSIS
    "Write python/pyspark/..any language code/script" -> CODE_SCRIPTING
    "What is the ERD of this DB?" -> DB_KNOWLEDGE
    "Hello!" -> GENERAL

    Input: "{input}"
    Intent:
    """
    )
intent_chain = LLMChain(llm=conversational_llm, prompt=INTENT_PROMPT)

# ---------------------- Router ----------------------
def chat_router(user_input: str, db_agent: DBExpertAgent, memory):
    intent = intent_chain.run(user_input).strip().upper()
    print(f"[Intent: {intent}]")

    query_id = get_query_hash(user_input)
    if query_id in query_cache:
        return query_cache[query_id]

    visualize_flag = False  # Return this to trigger visualization later

    if "SQL_ANALYSIS" in intent:
        sql = db_agent.generate_sql(user_input, memory)
        df = db_agent.run_query(sql)
        insights = db_agent.explain_data(df)
        result = (df.to_dict(orient="records"), insights)
        visualize_flag = True

    elif "CODE_SCRIPTING" in intent:
        script = db_agent.generate_coding_script(user_input, memory)
        result = (None, script)

    elif "DB_KNOWLEDGE" in intent:
        erd = db_agent.generate_er_diagram_description(user_input, memory)
        result = (None, erd)

    else:
        prompt = PromptTemplate.from_template(
            """
            You are a helpful and intelligent AI assistant.

            Your task is to:
            - Briefly summarize the relevant parts of the conversation history if useful.
            - Understand the user's current input in the context of prior messages.
            - Provide a clear, concise, and informative response.

            Conversation History:
            {chat_history}

            User's Input:
            {input}

            Assistant:
            """
        )
        general_chain = LLMChain(llm=conversational_llm, prompt=prompt, memory=memory)
        response = general_chain.run(input=user_input)
        result = (None, response)

    query_cache[query_id] = result
    return (*result, visualize_flag)

# ---------------------- CLI Runner ----------------------
def main():
    db_engine = DBConnection(
        db_type="sqlite",
        username=None,
        password=None,
        host=None,
        port=None,
        database=r"ecommerce.db"
    )
    
    agent = DBExpertAgent(engine=db_engine)
    session_id = "user-session"
    memory = get_memory_for_session(session_id)

    print("💬 AI DB Assistant is ready! Type your questions...\n")
    while True:
        user_q = input("You: ")
        if user_q.lower() in {"exit", "quit"}:
            break
        log_event("user_input", user_q)

        df_dict, response, visualize_flag = chat_router(user_q, agent, memory)
        
        if df_dict:
            df = pd.DataFrame(df_dict)
            print("📊 Result:\n", df.head())

        print("🤖", response)

        if visualize_flag and df_dict:
            if sys.stdin.isatty() and input("📊 Visualize the data? (yes/no): ").strip().lower() == "yes":
                agent.visualize_data(df)


# ---------------------- Run ----------------------
if __name__ == "__main__":
    main()
