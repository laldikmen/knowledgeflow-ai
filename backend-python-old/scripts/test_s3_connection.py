import sys
from pathlib import Path

from botocore.exceptions import BotoCoreError, ClientError


BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.aws_clients import get_s3_client
from app.config import Config


def main() -> None:
    Config.validate_aws()

    try:
        s3_client = get_s3_client()

        s3_client.head_bucket(
            Bucket=Config.S3_BUCKET_NAME
        )

        response = s3_client.list_objects_v2(
            Bucket=Config.S3_BUCKET_NAME,
            Prefix="projects/",
        )

        objects = response.get("Contents", [])

        print("S3 connection successful.")
        print(f"Bucket: {Config.S3_BUCKET_NAME}")
        print(f"Objects under projects/: {len(objects)}")

        if not objects:
            print("No objects found under projects/.")

        for item in objects:
            print(
                f"- {item['Key']} "
                f"({item['Size']} bytes)"
            )

    except (BotoCoreError, ClientError) as exc:
        print(f"S3 connection failed: {exc}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()