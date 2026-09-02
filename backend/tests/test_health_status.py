from app.main import build_health_status


def test_build_health_status_reports_healthy_when_all_services_are_up():
    payload = build_health_status(database_ok=True, redis_ok=True)
    assert payload["status"] == "healthy"
    assert payload["database"] == "connected"
    assert payload["redis"] == "connected"


def test_build_health_status_reports_degraded_when_services_are_down():
    payload = build_health_status(database_ok=False, redis_ok=False)
    assert payload["status"] == "degraded"
    assert payload["database"] == "disconnected"
    assert payload["redis"] == "unavailable"
