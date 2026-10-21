import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

DB_USER = os.getenv("DB_USER", "cloudforge")
DB_PASSWORD = os.getenv("DB_PASSWORD", "cloudforge_dev")
# Default to the IPv4 loopback explicitly: letting psycopg resolve
# "localhost" first tries ::1, which is refused on Windows dev setups and
# added multi-second stalls to every fresh connection.
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "5434")
DB_NAME = os.getenv("DB_NAME", "cloudforge")

DATABASE_URL = (
    f"postgresql+psycopg://{DB_USER}:{DB_PASSWORD}"
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)


class Base(DeclarativeBase):
    pass


engine = create_engine(
    DATABASE_URL,
    echo=False
)


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False
)
