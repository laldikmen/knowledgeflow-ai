from contextlib import contextmanager
from typing import Generator

import psycopg
from psycopg import Connection

from app.config import Config


def get_connection() -> Connection:
    Config.validate_database()

    return psycopg.connect(
        host=Config.DB_HOST,
        port=Config.DB_PORT,
        dbname=Config.DB_NAME,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        sslmode=Config.DB_SSLMODE,
        connect_timeout=10,
    )


@contextmanager
def database_connection() -> Generator[Connection, None, None]:
    connection = get_connection()

    try:
        yield connection
    finally:
        connection.close()