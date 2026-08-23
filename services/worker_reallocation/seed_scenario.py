import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Load your Supabase credentials from the .env file
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY") # Must use Service Role to bypass RLS

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in your .env file.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def seed_bottleneck_scenario():
    print("Fetching existing operators...")
    response = supabase.table("operators").select("id, name").limit(2).execute()
    
    if len(response.data) < 2:
        print("Error: You need at least 2 operators in your database. Run the CSV import on the frontend first.")
        return

    operator_1 = response.data[0]['id'] # The struggling worker
    operator_2 = response.data[1]['id'] # The high-performing savior

    print(f"Setting up {response.data[0]['name']} as the bottleneck (Line-A, Single Needle)...")
    print(f"Setting up {response.data[1]['name']} as the high performer (Line-B)...")

    # 1. Setup Production Status (The Problem)
    supabase.table("production_status").upsert([
        {"station_id": "STN-A1", "line_id": "LINE-A", "wip": 450, "targeted_productivity": 0.85, "actual_productivity": 0.40, "required_skill": "Single Needle"},
        {"station_id": "STN-B1", "line_id": "LINE-B", "wip": 10, "targeted_productivity": 0.85, "actual_productivity": 0.95, "required_skill": "Overlock"}
    ]).execute()

    # 2. Setup Operator Productivity (Current Locations)
    supabase.table("operator_productivity").upsert([
        {"operator_id": operator_1, "current_line_id": "LINE-A", "current_station": "STN-A1", "productivity_level": 0.40},
        {"operator_id": operator_2, "current_line_id": "LINE-B", "current_station": "STN-B1", "productivity_level": 0.95}
    ]).execute()

    # 3. Setup Skill Matrix (The Solution)
    supabase.table("skill_matrix").upsert([
        {"operator_id": operator_1, "machine_type": "Single Needle", "proficiency_grade": "C"},
        {"operator_id": operator_2, "machine_type": "Single Needle", "proficiency_grade": "A"}, # Op 2 is highly skilled at Op 1's machine
        {"operator_id": operator_2, "machine_type": "Overlock", "proficiency_grade": "A"}
    ]).execute()

    # 4. Inject Risk Analysis Data (The Trigger)
    supabase.table("laborers_data").insert([
        {"operator_id": operator_1, "output": 15, "smv": 1.2, "efficiency": 0.40, "status": "LOW"},
        {"operator_id": operator_2, "output": 55, "smv": 1.5, "efficiency": 0.95, "status": "HIGH"}
    ]).execute()

    print(" Scenario seeded successfully. Run your reallocation algorithm now.")

if __name__ == "__main__":
    seed_bottleneck_scenario()