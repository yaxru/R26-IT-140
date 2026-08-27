"""
Generate a test secure-link token for local frontend testing.

Usage:
    python generate_test_token.py --secret YOUR_SECURE_LINK_SECRET \\
        --worker-id EMP-1042 --worker-name "Nimal Perera"

Requires PyJWT: pip install PyJWT
Must use the exact same secret as SECURE_LINK_SECRET in your Flask backend's .env.
"""

import argparse
import time

import jwt

parser = argparse.ArgumentParser()
parser.add_argument("--secret", required=True, help="Must match SECURE_LINK_SECRET in backend .env")
parser.add_argument("--worker-id", default="EMP-1042")
parser.add_argument("--worker-name", default="Nimal Perera")
parser.add_argument("--expires-in", type=int, default=7200, help="seconds until token expires")
parser.add_argument("--base-url", default="http://localhost:3000")
args = parser.parse_args()

payload = {
    "worker_id": args.worker_id,
    "worker_name": args.worker_name,
    "exp": int(time.time()) + args.expires_in,
}

token = jwt.encode(payload, args.secret, algorithm="HS256")

print("\nToken:")
print(token)
print("\nTest URL:")
print(f"{args.base_url}/?token={token}") 

