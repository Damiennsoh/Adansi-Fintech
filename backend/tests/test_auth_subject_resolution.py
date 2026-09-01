from app.middleware.auth import resolve_user_lookup_values


def test_resolve_user_lookup_values_handles_uuid_subject():
    value = "7b7b18ab-71d2-48a6-9ef5-fb092f0f76d1"
    uuid_value, phone_value = resolve_user_lookup_values(value)
    assert uuid_value is not None
    assert phone_value is None


def test_resolve_user_lookup_values_handles_phone_subject():
    uuid_value, phone_value = resolve_user_lookup_values("+233240000000")
    assert uuid_value is None
    assert phone_value == "+233240000000"
