# How To Run

## Terminal 1 — Backend

```bash
cd F:\ROOMBOOK
.\venv\Scripts\Activate.ps1
cd backend
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

- API Docs: http://localhost:8000/api/docs
- Health Check: http://localhost:8000/health

## Terminal 2 — Frontend

```bash
cd F:\ROOMBOOK\frontend
npm install
npm run dev
```

- App: http://localhost:3000

## Docker (All Services — Single Terminal)

```bash
cd F:\ROOMBOOK
copy .env.example .env
docker-compose up --build -d
```

- App via Nginx: http://localhost
- API Docs: http://localhost:8000/api/docs

## Stop

```bash
docker-compose down
```
