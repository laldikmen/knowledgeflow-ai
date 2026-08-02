from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.config import Config
from app.aws_clients import get_s3_client
from app.database import database_connection

app = FastAPI(
    title="KnowledgeFlow AI API",
    description="AI-powered enterprise knowledge management platform",
    version="0.1.0"
)


class HealthResponse(BaseModel):
    status: str
    message: str


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: str


class DocumentUploadResponse(BaseModel):
    document_id: int
    filename: str
    s3_key: str
    size_bytes: int
    message: str


@app.get("/health", response_model=HealthResponse)
def health_check():
    """System health check"""
    try:
        Config.validate_aws()
        Config.validate_database()

        with database_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT current_database();")
                cursor.fetchone()

        return HealthResponse(
            status="healthy",
            message="All systems operational"
        )
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Health check failed: {str(e)}"
        )


@app.get("/projects", response_model=list[ProjectResponse])
def list_projects():
    """List all projects (MVP: returns sample data)"""
    try:
        with database_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT id, name, description
                    FROM projects
                    ORDER BY created_at DESC
                    LIMIT 10;
                    """
                )

                rows = cursor.fetchall()

                projects = [
                    ProjectResponse(
                        id=row[0],
                        name=row[1],
                        description=row[2] or "No description"
                    )
                    for row in rows
                ]

                return projects

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch projects: {str(e)}"
        )


@app.post("/documents/upload", response_model=DocumentUploadResponse)
def upload_document(
    project_id: int,
    filename: str,
    file_content: bytes
):
    """
    Upload a document to S3 and store metadata in RDS

    Args:
        project_id: Project ID
        filename: Document filename
        file_content: File content as bytes

    Returns:
        DocumentUploadResponse with S3 key and document ID
    """
    try:
        Config.validate_aws()
        Config.validate_database()

        s3_key = f"projects/{project_id}/documents/{filename}"

        s3_client = get_s3_client()
        s3_client.put_object(
            Bucket=Config.S3_BUCKET_NAME,
            Key=s3_key,
            Body=file_content,
            ContentType="text/plain"
        )

        file_size = len(file_content)

        with database_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO documents (project_id, filename, s3_key, file_size_bytes, status)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id;
                    """,
                    (project_id, filename, s3_key, file_size, "uploaded")
                )

                document_id = cursor.fetchone()[0]
                connection.commit()

        return DocumentUploadResponse(
            document_id=document_id,
            filename=filename,
            s3_key=s3_key,
            size_bytes=file_size,
            message="Document uploaded successfully"
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Document upload failed: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
