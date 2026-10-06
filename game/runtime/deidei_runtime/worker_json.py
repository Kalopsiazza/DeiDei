"""Duplicate JSON keys fail at both local process boundaries."""
def strict_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("INVALID_REQUEST")
        result[key] = value
    return result
