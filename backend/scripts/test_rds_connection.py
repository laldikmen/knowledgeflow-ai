import sys
from pathlib import Path

import psycopg


BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.database import database_connection


def main() -> None:
    try:
        with database_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT
                        current_database(),
                        current_user,
                        version();
                    """
                )

                result = cursor.fetchone()

                if result is None:
                    raise RuntimeError(
                        "Database information query returned no result."
                    )

                database_name, user_name, version = result

                cursor.execute(
                    """
                    SELECT COUNT(*)
                    FROM pg_tables
                    WHERE schemaname = 'public';
                    """
                )

                count_result = cursor.fetchone()

                if count_result is None:
                    raise RuntimeError(
                        "Table count query returned no result."
                    )

                table_count = count_result[0]

        print("RDS PostgreSQL connection successful.")
        print(f"Database: {database_name}")
        print(f"User: {user_name}")
        print(f"Public table count: {table_count}")
        print(f"Version: {version}")

    except (psycopg.Error, RuntimeError) as exc:
        print(f"RDS connection failed: {exc}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()