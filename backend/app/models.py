from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Date, Boolean, Numeric, JSON,
    ForeignKey, func
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True)
    password_hash = Column(Text, nullable=False)
    system_role = Column(String, nullable=False, default="member")
    account_status = Column(String, nullable=False, default="active")
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    projects_created = relationship("Project", foreign_keys="Project.created_by", back_populates="creator")
    project_memberships = relationship("ProjectMember", back_populates="user")
    documents_uploaded = relationship("Document", foreign_keys="Document.uploaded_by", back_populates="uploader")
    action_items_assigned = relationship("ActionItem", foreign_keys="ActionItem.assigned_to_user_id", back_populates="assigned_to")
    action_items_reviewed = relationship("ActionItem", foreign_keys="ActionItem.reviewed_by", back_populates="reviewed_by_user")
    action_items_completed = relationship("ActionItem", foreign_keys="ActionItem.completed_by", back_populates="completed_by_user")
    action_items_cancelled = relationship("ActionItem", foreign_keys="ActionItem.cancelled_by", back_populates="cancelled_by_user")
    chat_messages = relationship("ChatMessage", back_populates="user")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    department_name = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    creator = relationship("User", foreign_keys=[created_by], back_populates="projects_created")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="project", cascade="all, delete-orphan")
    action_items = relationship("ActionItem", back_populates="project", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="project", cascade="all, delete-orphan")


class ProjectMember(Base):
    __tablename__ = "project_members"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_role = Column(String, nullable=False)
    added_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    joined_at = Column(DateTime, nullable=False, default=func.now())

    project = relationship("Project", back_populates="members")
    user = relationship("User", back_populates="project_memberships", foreign_keys=[user_id])


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    file_name = Column(String, nullable=False)
    file_type = Column(String, nullable=True)
    document_type = Column(String, nullable=True)
    s3_key = Column(Text, nullable=False)
    s3_url = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="uploaded")
    uploaded_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    project = relationship("Project", back_populates="documents")
    uploader = relationship("User", foreign_keys=[uploaded_by], back_populates="documents_uploaded")
    document_text = relationship("DocumentText", back_populates="document", uselist=False, cascade="all, delete-orphan")
    summaries = relationship("AISummary", back_populates="document", cascade="all, delete-orphan")
    decisions = relationship("Decision", back_populates="document", cascade="all, delete-orphan")
    action_items = relationship("ActionItem", back_populates="document", cascade="all, delete-orphan")


class DocumentText(Base):
    __tablename__ = "document_texts"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    extracted_text = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    document = relationship("Document", back_populates="document_text")


class AISummary(Base):
    __tablename__ = "ai_summaries"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    summary_text = Column(Text, nullable=False)
    review_status = Column(String, nullable=False, default="draft")
    created_by_ai = Column(Boolean, nullable=False, default=True)
    ai_confidence = Column(Numeric, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_note = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    document = relationship("Document", back_populates="summaries")


class Decision(Base):
    __tablename__ = "decisions"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    decision_text = Column(Text, nullable=False)
    source_excerpt = Column(Text, nullable=True)
    review_status = Column(String, nullable=False, default="draft")
    created_by_ai = Column(Boolean, nullable=False, default=True)
    ai_confidence = Column(Numeric, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_note = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    document = relationship("Document", back_populates="decisions")


class ActionItem(Base):
    __tablename__ = "action_items"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    task_title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    source_excerpt = Column(Text, nullable=True)
    suggested_owner_text = Column(String, nullable=True)
    assigned_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    deadline = Column(Date, nullable=True)
    status = Column(String, nullable=False, default="draft")
    risk_level = Column(String, nullable=False, default="low")
    created_by_ai = Column(Boolean, nullable=False, default=True)
    ai_confidence = Column(Numeric, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_note = Column(Text, nullable=True)
    completed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    completed_at = Column(DateTime, nullable=True)
    completion_note = Column(Text, nullable=True)
    cancelled_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    cancel_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    project = relationship("Project", back_populates="action_items")
    document = relationship("Document", back_populates="action_items")
    assigned_to = relationship("User", foreign_keys=[assigned_to_user_id], back_populates="action_items_assigned")
    reviewed_by_user = relationship("User", foreign_keys=[reviewed_by], back_populates="action_items_reviewed")
    completed_by_user = relationship("User", foreign_keys=[completed_by], back_populates="action_items_completed")
    cancelled_by_user = relationship("User", foreign_keys=[cancelled_by], back_populates="action_items_cancelled")
    status_history = relationship("TaskStatusHistory", back_populates="task", cascade="all, delete-orphan")


class TaskStatusHistory(Base):
    __tablename__ = "task_status_history"

    id = Column(Integer, primary_key=True)
    task_id = Column(Integer, ForeignKey("action_items.id"), nullable=False)
    previous_status = Column(String, nullable=True)
    new_status = Column(String, nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    change_note = Column(Text, nullable=True)
    changed_at = Column(DateTime, nullable=False, default=func.now())

    task = relationship("ActionItem", back_populates="status_history")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    sources_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False, default=func.now())

    project = relationship("Project", back_populates="chat_messages")
    user = relationship("User", back_populates="chat_messages")
