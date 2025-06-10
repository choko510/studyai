# Python Backend for Interstellar

This project is a Python-based backend replacement for the original Node.js Interstellar application. It aims to replicate the core functionalities, including:

*   Serving static client-side files.
*   Providing a Bare server proxy (compatible with Ultraviolet) for web unblocking.
*   An API endpoint for image analysis using Google Gemini.
*   An asset proxy for fetching external resources with caching.
*   Configurable basic authentication to protect the service.

## Prerequisites

*   Python 3.8+
*   Access to the original project's `static` directory assets.

## Setup

1.  **Clone the Repository (or place this `python_backend` directory appropriately).**

2.  **Copy Static Assets:**
    *   The complete `static` directory from the original Node.js project must be copied into this `python_backend/static/` directory. This includes all HTML, CSS, JavaScript, and other assets required by the client-side application.

3.  **Install Dependencies:**
    *   It's highly recommended to use a Python virtual environment.
    ```bash
    python -m venv .venv
    source .venv/bin/activate  # On Windows: .venv\Scripts\activate
    ```
    *   Install the required packages:
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure Environment Variables:**
    *   Create a `.env` file in the `python_backend` directory by copying `.env.example`:
    ```bash
    cp .env.example .env
    ```
    *   Edit the `.env` file with your specific configurations:
        *   `GEMINI_API_KEY`: Your Google Gemini API key. This is required for the image analysis feature at `/api/aireq`.
        *   `CHALLENGE_PASSWORD`: Set to `"true"` to enable basic authentication for the service (excluding `/api/*` and `/ca/*` routes). Set to `"false"` to disable.
        *   `APP_USER_USERNAME_DASH_PASSWORD_ETC`: If `CHALLENGE_PASSWORD="true"`, define users for basic authentication. For example, to create a user `interstellar` with password `securepass`, add a line like:
            `APP_USER_INTERSTELLAR="securepass"`
            You can add multiple such lines for different users. The username part (`INTERSTELLAR` in the example) will be converted to lowercase.

## Running the Server

*   Once dependencies are installed and the `.env` file is configured, run the FastAPI server:
```bash
python main.py
```
*   Or, using Uvicorn directly (which allows for more options like specifying workers):
```bash
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```
*   The server will typically be available at `http://localhost:8080`.

## Key Functionalities

*   **Main Application:** Accessible at `/`. Serves `static/index.html`. Protected by basic auth if enabled.
*   **Static Files:** Served from `/static/`.
*   **Bare Server Proxy:** Endpoint at `/ca/`. This is used by client-side scripts (e.g., Ultraviolet) for proxying web content.
*   **Gemini Image Analysis API:** Endpoint at `POST /api/aireq`. Requires a multipart/form-data image upload and an optional `prompt` field. Streams a text response.
*   **External Asset Proxy:** Endpoints under `/e/*` (e.g., `/e/1/some/asset.js`). Fetches and caches assets from predefined GitHub repositories.

## Important Notes

*   **Bare Server Compatibility:** The Bare server implementation is foundational. Thorough testing with the specific client-side JavaScript (Ultraviolet version) used in your `static` assets is crucial to ensure full compatibility.
*   **Security:** If using Basic Authentication, ensure the service is deployed over HTTPS to protect credentials.
*   **Static Assets:** The functionality of this backend heavily relies on the client-side JavaScript and assets from the original project's `static` folder. Ensure these are correctly copied.
