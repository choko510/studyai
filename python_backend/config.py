import os
from dotenv import load_dotenv

load_dotenv() # Load .env file

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
CHALLENGE_PASSWORD = os.getenv("CHALLENGE_PASSWORD", "false").lower() == "true"

# Load users from environment variables like APP_USER_USERNAME=password
# Example: APP_USER_INTERSTELLAR="securepassword123"
USERS = {}
for key, value in os.environ.items():
    if key.startswith("APP_USER_"):
        username = key.replace("APP_USER_", "").lower()
        USERS[username] = value

# Fallback if no users are defined in environment, use the hardcoded one (less secure)
if not USERS and os.getenv("BASIC_AUTH_USER") and os.getenv("BASIC_AUTH_PASS"):
    USERS[os.getenv("BASIC_AUTH_USER")] = os.getenv("BASIC_AUTH_PASS")
elif not USERS: # Default if nothing else is set
    USERS["interstellar"] = "password"


# Print loaded users for verification (optional, remove in production)
if CHALLENGE_PASSWORD:
    print("🔒 Password protection is enabled. Loaded users:")
    for username, password in USERS.items():
        print(f"  Username: {username}, Password: {'*' * len(password)}") # Mask password
else:
    print("🔓 Password protection is disabled.")
