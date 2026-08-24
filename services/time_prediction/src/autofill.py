from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = BASE_DIR / "data" / "garments_worker_productivity.csv"

# Columns we want to auto-fill (numeric ones from your dataset)
NUM_COLS = [
    "targeted_productivity", "wip", "over_time", "incentive",
    "idle_time", "idle_men", "no_of_style_change", "no_of_workers"
]

class AutoFillSource:
    def __init__(self, csv_path: Path = DATA_PATH):
        self.df = pd.read_csv(csv_path)

        # Ensure required columns exist
        missing = [c for c in ["department", "team", "day"] + NUM_COLS if c not in self.df.columns]
        if missing:
            raise ValueError(f"Dataset missing columns: {missing}")

        # Some datasets have NaNs (e.g., wip). We'll handle via medians.
        self.global_medians = self.df[NUM_COLS].median(numeric_only=True)

        # Build grouped medians for better defaults
        self.grp_dept_team_day = self.df.groupby(["department", "team", "day"])[NUM_COLS].median(numeric_only=True)
        self.grp_dept_day = self.df.groupby(["department", "day"])[NUM_COLS].median(numeric_only=True)
        self.grp_dept = self.df.groupby(["department"])[NUM_COLS].median(numeric_only=True)

    def _lookup(self, department: str, team: float, day: str):
        # 1) department + team + day
        key1 = (department, team, day)
        if key1 in self.grp_dept_team_day.index:
            return self.grp_dept_team_day.loc[key1]

        # 2) department + day
        key2 = (department, day)
        if key2 in self.grp_dept_day.index:
            return self.grp_dept_day.loc[key2]

        # 3) department only
        key3 = (department,)
        if key3 in self.grp_dept.index:
            return self.grp_dept.loc[key3]

        # 4) global fallback
        return self.global_medians

    def build_features(self, department: str, team: float, date_str: str, overrides=None):
        """
        Returns a dict that matches the model feature columns used in training.
        date_str must be YYYY-MM-DD (recommended).
        overrides: dict of values to override autofilled features (e.g., no_of_workers, over_time)
        """
        dt = pd.to_datetime(date_str, errors="raise")
        day_name = dt.strftime("%A")  # e.g., 'Thursday'
        month = int(dt.month)
        day_of_month = int(dt.day)

        defaults = self._lookup(department, team, day_name)

        # Base features
        features = {
            "department": department,
            "day": day_name,
            "team": float(team),
            "month": month,
            "day_of_month": day_of_month,
        }

        # Autofill numeric columns
        for col in NUM_COLS:
            val = defaults.get(col)
            if pd.isna(val):
                val = float(self.global_medians[col])
            features[col] = float(val)

        # Apply overrides (if provided)
        if overrides:
            for k, v in overrides.items():
                if v is not None:
                    features[k] = float(v)

        if "smv" not in features:
            raise ValueError("smv must be provided as input")           

        return features