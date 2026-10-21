from sqlalchemy import text

from app.db.database import engine


if __name__ == "__main__":
    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            print("Database connection successful!")
            print("Result:", result.scalar())

    except Exception as e:
        print("Database connection failed!")
        print(e)
