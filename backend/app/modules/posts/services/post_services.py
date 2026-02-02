from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime

from app.modules.posts.models.post import Post
from app.modules.posts.schemas.post_schemas import PostCreate, PostUpdate, PostResponse
from app.modules.user.models.user import User
from app.utils.logger import get_logger

logger = get_logger("post-services")


def create_post(db: Session, post_data: PostCreate, created_by: UUID) -> PostResponse:
    new_post = Post(
        title=post_data.title,
        category=post_data.topic,
        status=post_data.status,
        content=post_data.content,
        admin_notes=post_data.admin_notes,
        created_by=created_by
    )
    db.add(new_post)
    db.commit()
    db.refresh(new_post)

    # Get the user who created the post
    user = db.query(User).filter(User.userid == created_by).first()

    # Determine display name
    if user:
        if user.role in ['admin', 'super-admin']:
            display_name = 'ADMIN'
        else:
            display_name = user.username
        role = user.role.value
    else:
        display_name = 'Unknown'
        role = 'student'

    # Create PostResponse
    post_dict = {
        'post_id': new_post.post_id,
        'title': new_post.title,
        'category': new_post.category,
        'status': new_post.status,
        'content': new_post.content,
        'admin_notes': new_post.admin_notes,
        'created_at': new_post.created_at,
        'updated_at': new_post.updated_at,
        'created_by': display_name,
        'created_by_role': role
    }

    return PostResponse(**post_dict)


def get_post(db: Session, post_id: UUID) -> PostResponse | None:
    post = db.query(Post).filter(Post.post_id == post_id).first()
    if not post:
        return None

    # Get the user who created the post
    user = db.query(User).filter(User.userid == post.created_by).first()

    # Determine display name
    if user:
        if user.role in ['admin', 'super-admin']:
            display_name = 'ADMIN'
        else:
            display_name = user.username
        role = user.role.value
    else:
        display_name = 'Unknown'
        role = 'student'

    # Create PostResponse with modified created_by
    post_dict = {
        'post_id': post.post_id,
        'title': post.title,
        'category': post.category,
        'status': post.status,
        'content': post.content,
        'admin_notes': post.admin_notes,
        'created_at': post.created_at,
        'updated_at': post.updated_at,
        'created_by': display_name,
        'created_by_role': role
    }

    return PostResponse(**post_dict)


def get_all_posts(db: Session) -> list[PostResponse]:
    posts = db.query(Post).order_by(Post.created_at.desc()).all()
    result = []

    for post in posts:
        # Get the user who created the post
        user = db.query(User).filter(User.userid == post.created_by).first()

        # Determine display name
        if user:
            if user.role in ['admin', 'super-admin']:
                display_name = 'ADMIN'
            else:
                display_name = user.username
            role = user.role.value
        else:
            display_name = 'Unknown'
            role = 'student'

        # Create PostResponse with modified created_by
        post_dict = {
            'post_id': post.post_id,
            'title': post.title,
            'category': post.category,
            'status': post.status,
            'content': post.content,
            'admin_notes': post.admin_notes,
            'created_at': post.created_at,
            'updated_at': post.updated_at,
            'created_by': display_name,
            'created_by_role': role
        }

        result.append(PostResponse(**post_dict))

    return result


def update_post(db: Session, post_id: UUID, post_data: PostUpdate) -> PostResponse | None:
    post = db.query(Post).filter(Post.post_id == post_id).first()
    if not post:
        return None

    update_dict = post_data.model_dump(exclude_unset=True)
    # Map topic to category for database
    if 'topic' in update_dict:
        update_dict['category'] = update_dict.pop('topic')

    for key, value in update_dict.items():
        setattr(post, key, value)

    post.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(post)

    # Get the user who created the post
    user = db.query(User).filter(User.userid == post.created_by).first()

    # Determine display name
    if user:
        if user.role in ['admin', 'super-admin']:
            display_name = 'ADMIN'
        else:
            display_name = user.username
        role = user.role.value
    else:
        display_name = 'Unknown'
        role = 'student'

    # Create PostResponse
    post_dict = {
        'post_id': post.post_id,
        'title': post.title,
        'category': post.category,
        'status': post.status,
        'content': post.content,
        'admin_notes': post.admin_notes,
        'created_at': post.created_at,
        'updated_at': post.updated_at,
        'created_by': display_name,
        'created_by_role': role
    }

    return PostResponse(**post_dict)


def delete_post(db: Session, post_id: UUID) -> bool:
    post = db.query(Post).filter(Post.post_id == post_id).first()
    if not post:
        return False
    
    db.delete(post)
    db.commit()
    return True
