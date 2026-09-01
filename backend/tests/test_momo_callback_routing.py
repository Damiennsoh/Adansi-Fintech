from app.routers.momo import classify_client_reference


def test_classify_client_reference_for_contributions():
    assert classify_client_reference("CONT-AB12CD34") == "contribution"


def test_classify_client_reference_for_withdrawals():
    assert classify_client_reference("WITH-AB12CD34") == "withdrawal"


def test_classify_client_reference_rejects_unknown_prefix():
    assert classify_client_reference("OTHER-AB12CD34") == "unknown"
