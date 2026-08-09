import json
import sys
from pathlib import Path

from botocore.exceptions import BotoCoreError, ClientError


BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.aws_clients import get_sts_client


def main() -> None:
    try:
        sts_client = get_sts_client()
        identity = sts_client.get_caller_identity()

        print("AWS identity test successful.")
        print(json.dumps(identity, indent=2))

    except (BotoCoreError, ClientError) as exc:
        print(f"AWS identity test failed: {exc}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()