import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"

load_dotenv(ENV_FILE)


class Config:
    AWS_REGION = os.getenv("AWS_REGION", "eu-central-1")
    AWS_PROFILE = os.getenv("AWS_PROFILE")
    S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")

    DB_HOST = os.getenv("DB_HOST")
    DB_PORT = int(os.getenv("DB_PORT", "5432"))
    DB_NAME = os.getenv("DB_NAME", "knowledgeflow")
    DB_USER = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    DB_SSLMODE = os.getenv("DB_SSLMODE", "require")

    @classmethod
    def validate_aws(cls) -> None:
        missing = []

        if not cls.S3_BUCKET_NAME:
            missing.append("S3_BUCKET_NAME")

        if missing:
            raise RuntimeError(
                "Missing AWS environment variables: "
                + ", ".join(missing)
            )

    @classmethod
    def validate_database(cls) -> None:
        values = {
            "DB_HOST": cls.DB_HOST,
            "DB_USER": cls.DB_USER,
            "DB_PASSWORD": cls.DB_PASSWORD,
        }

        missing = [
            key
            for key, value in values.items()
            if not value
        ]

        if missing:
            raise RuntimeError(
                "Missing database environment variables: "
                + ", ".join(missing)
            )