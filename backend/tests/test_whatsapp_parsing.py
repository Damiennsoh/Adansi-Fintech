from app.routers.whatsapp import normalize_whatsapp_phone, parse_whatsapp_command


def test_normalize_whatsapp_phone_strips_whatsapp_prefix():
    assert normalize_whatsapp_phone("whatsapp:+233240000000") == "+233240000000"


def test_parse_whatsapp_command_handles_balance_request():
    command, arg, phone = parse_whatsapp_command("whatsapp:+233240000000", "/balance ABCD12")
    assert phone == "+233240000000"
    assert command == "/balance"
    assert arg == "ABCD12"
