SHELL := /bin/bash

PYTHON ?= python3
VENV := .venv
VENV_PYTHON := $(VENV)/bin/python
PIP := $(VENV)/bin/pip

.PHONY: install dev check check-web check-api regression

install:
	$(PYTHON) -m venv --system-site-packages --clear $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install --timeout 20 --retries 1 -r apps/api/requirements.txt || $(VENV_PYTHON) scripts/check_python_deps.py
	cd apps/web && npm install --fetch-timeout=20000 --fetch-retries=1

dev:
	@trap 'kill 0' INT TERM EXIT; \
	(cd apps/api && ../../$(VENV_PYTHON) -m uvicorn main:app --host 127.0.0.1 --port 8000) & \
	(cd apps/web && npm run dev -- --host 127.0.0.1 --port 5173) & \
	wait

check: check-web check-api

check-web:
	cd apps/web && npm run check

check-api:
	$(VENV_PYTHON) scripts/check_api.py
	$(VENV_PYTHON) -m pytest

regression:
	$(VENV_PYTHON) -m pytest tests/regression
