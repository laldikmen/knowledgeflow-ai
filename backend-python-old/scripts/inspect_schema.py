#!/usr/bin/env python3
"""Inspect PostgreSQL schema to generate SQLAlchemy models"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import database_connection

def inspect_tables():
    """Get all tables and their columns from PostgreSQL"""
    with database_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name;
                """
            )

            tables = [row[0] for row in cursor.fetchall()]

            print(f"\n📊 Found {len(tables)} tables:\n")

            for table_name in tables:
                cursor.execute(
                    """
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_name = %s
                    ORDER BY ordinal_position;
                    """,
                    (table_name,)
                )

                columns = cursor.fetchall()

                print(f"\n📋 {table_name}:")
                for col_name, data_type, is_nullable, default in columns:
                    nullable = "NULL" if is_nullable == "YES" else "NOT NULL"
                    default_str = f" DEFAULT {default}" if default else ""
                    print(f"  - {col_name}: {data_type} {nullable}{default_str}")

if __name__ == "__main__":
    inspect_tables()
