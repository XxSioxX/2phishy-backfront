from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from app.core.database_postgres import get_db
from app.core.auth import require_admin_role, require_role, get_current_active_user
from app.modules.user.models.user import User
from app.modules.posts.schemas.post_schemas import PostCreate, PostUpdate, PostResponse
from app.modules.posts.services.post_services import (
    create_post, get_post, get_all_posts, update_post, delete_post
)
from app.utils.logger import get_logger

router = APIRouter(prefix="/posts", tags=["posts"])
logger = get_logger("post-routes")


@router.post("/", response_model=PostResponse)
def create_new_post(
    post_data: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("student"))
):
    logger.info(f"User {current_user.username} creating new post")
    return create_post(db, post_data, current_user.userid)


@router.get("/", response_model=list[PostResponse])
def get_posts(db: Session = Depends(get_db)):
    posts = get_all_posts(db)
    return [post for post in posts]


@router.get("/{post_id}", response_model=PostResponse)
def get_post_by_id(post_id: str, db: Session = Depends(get_db)):
    post = get_post(db, UUID(post_id))
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.put("/{post_id}", response_model=PostResponse)
def update_existing_post(
    post_id: str,
    post_data: PostUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role)
):
    logger.info(f"Admin {current_user.username} updating post {post_id}")
    post = update_post(db, UUID(post_id), post_data)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return post


@router.delete("/{post_id}")
def delete_existing_post(
    post_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Get the post to check ownership
    post = get_post(db, UUID(post_id))
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Allow if admin or if the post is created by the current user
    if current_user.role.value not in ["admin", "super-admin"] and str(post.created_by) != str(current_user.userid):
        raise HTTPException(status_code=403, detail="Access denied. You can only delete your own posts")
    
    logger.info(f"User {current_user.username} deleting post {post_id}")
    if not delete_post(db, UUID(post_id)):
        raise HTTPException(status_code=404, detail="Post not found")
    return {"message": "Post deleted successfully"}
