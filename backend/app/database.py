import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://si_user:si_password@localhost:5432/si_investing",
)

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    _add_missing_columns()


def _add_missing_columns():
    # create_all() doesn't alter existing tables, so add columns introduced after
    # a database was first created.
    columns = {c["name"] for c in inspect(engine).get_columns("dividend_holdings")}
    if "price_updated_at" not in columns:
        with engine.begin() as conn:
            conn.execute(
                text(
                    "ALTER TABLE dividend_holdings "
                    "ADD COLUMN price_updated_at TIMESTAMP WITH TIME ZONE"
                )
            )
