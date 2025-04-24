from langchain_community.utilities import SQLDatabase
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError


class DBConnection:

    def __init__(self,
                 db_type,
                 username=None,
                 password=None,
                 host=None,
                 port=None,
                 database=None,
                 **kwargs):
        self.db_type = db_type.lower()
        self.username = username
        self.password = password
        self.host = host
        self.port = port
        self.database = database
        self.kwargs = kwargs  # For driver, schema, warehouse, project, etc.

    def get_connection_string(self):
        """ Db connection URL to create Engines"""

        port = f":{self.port}" if self.port else ""

        if self.db_type == "sqlite":
            return f"sqlite:///{self.database}"
        elif self.db_type == "sqlite+pysqlite":
            return f"sqlite+pysqlite:///{self.database}"
        elif self.db_type == "postgresql":
            return f"postgresql://{self.username}:{self.password}@{self.host}{port}/{self.database}"
        elif self.db_type == "postgresql+psycopg2":
            return f"postgresql+psycopg2://{self.username}:{self.password}@{self.host}{port}/{self.database}"
        elif self.db_type == "mysql":
            return f"mysql+pymysql://{self.username}:{self.password}@{self.host}{port}/{self.database}"
        elif self.db_type == "mariadb":
            return f"mariadb+pymysql://{self.username}:{self.password}@{self.host}{port}/{self.database}"
        elif self.db_type == "mssql":
            driver = self.kwargs.get("driver", "SQL+Server")
            return f"mssql+pyodbc://{self.username}:{self.password}@{self.host}/{self.database}?driver={driver}"
        elif self.db_type == "oracle":
            return f"oracle+cx_oracle://{self.username}:{self.password}@{self.host}{port}/{self.database}"
        elif self.db_type == "ibm":
            return f"ibm_db_sa://{self.username}:{self.password}@{self.host}{port}/{self.database}"
        elif self.db_type == "cockroachdb":
            return f"cockroachdb://{self.username}:{self.password}@{self.host}{port}/{self.database}"
        elif self.db_type == "redshift":
            return f"redshift+psycopg2://{self.username}:{self.password}@{self.host}{port}/{self.database}"
        elif self.db_type == "gcp_mysql":
            return f"mysql+pymysql://{self.username}:{self.password}@/{self.database}?host={self.host}"
        elif self.db_type == "gcp_postgres":
            return f"postgresql+psycopg2://{self.username}:{self.password}@/{self.database}?host={self.host}"
        elif self.db_type == "hive":
            return f"hive://{self.username}:{self.password}@{self.host}{port}/{self.database}"
        elif self.db_type == "phoenix":
            return f"phoenix://{self.username}:{self.password}@{self.host}{port}/{self.database}"
        elif self.db_type == "clickhouse":
            return f"clickhouse+clickhouse_driver://{self.username}:{self.password}@{self.host}{port}/{self.database}"
        elif self.db_type == "vertica":
            return f"vertica+pyodbc://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"
        elif self.db_type == "snowflake":
            warehouse = self.kwargs.get("warehouse")
            schema = self.kwargs.get("schema")
            return f"snowflake://{self.username}:{self.password}@{self.host}/{self.database}?warehouse={warehouse}&schema={schema}"
        elif self.db_type == "sqlanywhere":
            return f"sqlanywhere+pyodbc://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"
        elif self.db_type == "exasol":
            return f"exasol://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"
        elif self.db_type == "firebird":
            return f"firebird+fdb://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"
        elif self.db_type == "athena":
            return f"awsathena://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"
        elif self.db_type == "bigquery":
            project = self.kwargs.get("project")
            return f"bigquery://{self.username}:{self.password}@{project}/{self.database}"
        elif self.db_type == "duckdb":
            return f"duckdb:///{self.database}"
        else:
            raise ValueError(f"❌ Unsupported db_type: {self.db_type}")

    def get_engine(self):
        """custom Db reading using Sqlalchemy"""
        try:
            conn_str = self.get_connection_string()
            engine = create_engine(conn_str)

            # Test connection with appropriate query
            with engine.connect() as conn:
                if self.db_type.startswith("sqlite"):
                    conn.execute(
                        text("SELECT name FROM sqlite_master LIMIT 1"))
                elif self.db_type.startswith(
                    ("postgresql", "redshift", "cockroachdb", "gcp_postgres")):
                    conn.execute(text("SELECT 1"))
                elif self.db_type.startswith(
                    ("mysql", "mariadb", "gcp_mysql")):
                    conn.execute(text("SELECT 1"))
                elif self.db_type.startswith("mssql"):
                    conn.execute(text("SELECT 1"))
                elif self.db_type == "oracle":
                    conn.execute(text("SELECT 1 FROM dual"))
                elif self.db_type == "snowflake":
                    conn.execute(text("SELECT CURRENT_VERSION()"))
                elif self.db_type == "bigquery":
                    conn.execute(text("SELECT 1"))
                elif self.db_type == "duckdb":
                    conn.execute(text("SELECT 1"))
                elif self.db_type == "clickhouse":
                    conn.execute(text("SELECT 1"))
                elif self.db_type == "ibm":
                    conn.execute(text("SELECT 1 FROM SYSIBM.SYSDUMMY1"))
                elif self.db_type == "firebird":
                    conn.execute(text("SELECT 1 FROM RDB$DATABASE"))
                elif self.db_type == "sqlanywhere":
                    conn.execute(text("SELECT 1"))
                elif self.db_type == "exasol":
                    conn.execute(text("SELECT 1"))
                elif self.db_type == "phoenix":
                    conn.execute(
                        text("SELECT table_name FROM system.catalog LIMIT 1"))
                elif self.db_type == "hive":
                    conn.execute(text("SHOW TABLES"))
                elif self.db_type == "athena":
                    conn.execute(text("SELECT 1"))
                elif self.db_type == "vertica":
                    conn.execute(text("SELECT version()"))
                else:
                    raise ValueError(
                        f"❌ No test query defined for db_type: {self.db_type}")

            print(f"✅ {self.db_type} DB connection successful")
            # return SQLDatabase(engine=engine)
            return engine

        except SQLAlchemyError as e:
            print(f"❌ Database connection failed: {e}")
            return None

    def get_sql_database(self):
        """ Optional Use using langchain SqlDatabase module directly chat with Db's"""
        try:
            uri = self.get_connection_string()
            db = SQLDatabase.from_uri(uri)
            print(
                f"✅ Connected to {self.db_type} using LangChain SQLDatabase.")
            return db
        except SQLAlchemyError as e:
            print(f"❌ SQLDatabase connection failed: {e}")
            return None


if __name__ == "__main__":

    db_engine = DBConnection(
        db_type="sqlite",  # Required
        username=None,
        password=None,
        host=None,
        port=None,
        database=
        r"C:\\Users\\SwapnilPharate\\Downloads\\PowerGridIntelligence\\PowerGridIntelligence_V1\\DB_connection\\example.db",

        # Snowflake
        warehouse=None,
        schema=None,

        # BigQuery
        project=None,

        # MSSQL / SQLAnywhere
        driver=None,

        # Oracle
        service_name=None,  # Often used in TNS
        sid=None,  # Optional alternative to service_name

        # Firebird
        charset=None,

        # Exasol
        encryption=None,
        compression=None,

        # Vertica
        connection_load_balance=None,
        backup_server_node=None,

        # Hive & Phoenix (optional if using Kerberos)
        authentication=None,
        kerberos_service_name=None,
    )

    engine = db_engine.get_engine()
    url = engine.url

    dialect = engine.url.get_backend_name()
    db_name = engine.url.database.split('/')[-1]

    print(dialect, db_name)
