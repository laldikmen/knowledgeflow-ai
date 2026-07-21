from typing import Any

import boto3
from boto3.session import Session

from app.config import Config


def create_aws_session() -> Session:
    session_options: dict[str, Any] = {
        "region_name": Config.AWS_REGION,
    }

    if Config.AWS_PROFILE:
        session_options["profile_name"] = Config.AWS_PROFILE

    return boto3.Session(**session_options)


def get_sts_client():
    return create_aws_session().client("sts")


def get_s3_client():
    return create_aws_session().client("s3")