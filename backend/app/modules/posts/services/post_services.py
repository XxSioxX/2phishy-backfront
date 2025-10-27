from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime

from app.modules.posts.models.post import Post
from app.modules.posts.schemas.post_schemas import PostCreate, PostUpdate
from app.utils.logger import get_logger

logger = get_logger("post-services")


def create_post(db: Session, post_data: PostCreate, created_by: UUID) -> Post:
    new_post = Post(
        title=post_data.title,
        category=post_data.category,
        status=post_data.status,
        content=post_data.content,
        admin_notes=post_data.admin_notes,
        created_by=created_by
    )
    db.add(new_post)
    db.commit()
    db.refresh(new_post)
    return new_post


def get_post(db: Session, post_id: UUID) -> Post | None:
    return db.query(Post).filter(Post.post_id == post_id).first()


def get_all_posts(db: Session) -> list[Post]:
    return db.query(Post).order_by(Post.created_at.desc()).all()


def update_post(db: Session, post_id: UUID, post_data: PostUpdate) -> Post | None:
    post = db.query(Post).filter(Post.post_id == post_id).first()
    if not post:
        return None
    
    for key, value in post_data.model_dump(exclude_unset=True).items():
        setattr(post, key, value)
    
    post.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(post)
    return post


def delete_post(db: Session, post_id: UUID) -> bool:
    post = db.query(Post).filter(Post.post_id == post_id).first()
    if not post:
        return False
    
    db.delete(post)
    db.commit()
    return True
