"""Worker selection and donor-risk calculations for reallocation recommendations."""

import math
from typing import Any, Optional


def select_workers(
    candidates: list[dict[str, Any]],
    personal_efficiency: dict[str, float],
    bottleneck_station: str,
    targeted_productivity: Optional[float],
    actual_productivity: Optional[float],
    config: dict[str, Any],
    shift_remaining_min: float,
) -> dict[str, Any]:
    # These values are configured in algorithm_config; main.py provides defaults.
    learning_penalty = config["learning_penalty"]
    baseline_eff = config["grade_efficiency"]
    fallback_gain = config["fallback_gain"]
    per_worker_fraction = config["system"]["per_worker_gain_fraction"]
    t_relocation = config["system"]["t_relocation_min"]

    # Use live productivity values when available; otherwise use grade-based fallback gains.
    use_dynamic = (
        targeted_productivity is not None
        and actual_productivity is not None
        and targeted_productivity > 0
    )
    remaining_gap = (
        max(0.0, targeted_productivity - actual_productivity)
        if use_dynamic
        else 0.0
    )

    # Estimate how many workers it may take to cover the productivity gap.
    best_grade = candidates[0]["proficiency_grade"].upper()
    if use_dynamic and remaining_gap > 0:
        best_boost = (
            targeted_productivity
            * per_worker_fraction
            * baseline_eff.get(best_grade, 1.0)
        )
        workers_needed = math.ceil(remaining_gap / best_boost) if best_boost > 0 else 1
    else:
        workers_needed = 1

    gap_left = remaining_gap
    selected = []
    used_ids = set()

    # Consider candidates in their supplied order and stop once the gap is covered
    # or the next move would cost more than its estimated production benefit.
    for candidate in candidates:
        if use_dynamic and gap_left <= 0:
            break

        operator_id = candidate["operator_id"]
        if operator_id in used_ids:
            continue

        grade = candidate["proficiency_grade"].upper()
        from_station = candidate.get("current_station")
        operator_info = candidate.get("operators") or {}

        if from_station == bottleneck_station:
            continue

        actual_eff = personal_efficiency.get(
            operator_id, baseline_eff.get(grade, 0.85)
        )
        if use_dynamic:
            per_worker_boost = targeted_productivity * per_worker_fraction * actual_eff
            this_gap_closed = min(gap_left, per_worker_boost)
            gain = this_gap_closed * shift_remaining_min
        else:
            per_worker_boost = 0.0
            gain = fallback_gain.get(grade, 14.0)

        # Cost is relocation time plus a preset learning allowance for this grade.
        cost = t_relocation + learning_penalty.get(grade, 5.0)
        profit = gain - cost
        if profit <= 0:
            break

        selected.append(
            {
                "operator_id": operator_id,
                "operator_name": operator_info.get("name", "Unknown"),
                "worker_pin": operator_info.get("worker_id", "N/A"),
                "from_station": from_station,
                "to_station": bottleneck_station,
                "proficiency_grade": candidate["proficiency_grade"],
                "cost_of_move": cost,
                "expected_production_gain": gain,
                "net_profit": profit,
            }
        )
        used_ids.add(operator_id)
        if use_dynamic:
            gap_left = max(0.0, gap_left - per_worker_boost)

    # Return the best available option as an explanation when no profitable move exists.
    no_move = None
    if not selected:
        candidate = candidates[0]
        grade = candidate["proficiency_grade"].upper()
        operator_info = candidate.get("operators") or {}
        actual_eff = personal_efficiency.get(
            candidate["operator_id"], baseline_eff.get(grade, 0.85)
        )
        if use_dynamic:
            boost = targeted_productivity * per_worker_fraction * actual_eff
            gain = min(remaining_gap, boost) * shift_remaining_min
        else:
            gain = fallback_gain.get(grade, 14.0)

        cost = t_relocation + learning_penalty.get(grade, 5.0)
        profit = gain - cost
        no_move = {
            "operator_id": candidate["operator_id"],
            "operator_name": operator_info.get("name", "Unknown"),
            "worker_pin": operator_info.get("worker_id", "N/A"),
            "from_station": candidate.get("current_station"),
            "to_station": bottleneck_station,
            "proficiency_grade": candidate["proficiency_grade"],
            "cost_of_move": cost,
            "expected_production_gain": gain,
            "net_profit": profit,
            "no_move_reason": (
                f"Best available worker would recover {gain:.1f} min but relocation "
                f"costs {cost:.1f} min - net {profit:.1f} min. No move justified."
            ),
        }

    # Report what percentage of the original productivity gap the selected moves cover.
    if use_dynamic and remaining_gap > 0:
        gap_coverage_pct = min(
            100.0,
            (remaining_gap - max(0.0, gap_left)) / remaining_gap * 100,
        )
    else:
        gap_coverage_pct = 100.0

    return {
        "selected": selected,
        "workers_needed": workers_needed,
        "gap_coverage_pct": gap_coverage_pct,
        "no_move": no_move,
    }


def evaluate_donor_risks(
    selected: list[dict[str, Any]],
    donor_data: dict[str, dict[str, Any]],
    donor_backfills: dict[str, tuple[str, str]],
    threshold_pct: float,
    per_worker_fraction: float,
) -> tuple[list[dict[str, Any]], list[str]]:
    # Moving a worker may create a new bottleneck at their original ("donor") station.
    cascade_warnings = []
    final_moves = []

    for move in selected:
        donor_id = move["from_station"]
        cascade_risk = False
        risk_detail = None
        replacement_id = None
        replacement_grade = None

        if donor_id and donor_id in donor_data:
            donor = donor_data[donor_id]
            # Compare the donor station's projected gap with the configured risk threshold.
            projected_gap_pct = projected_donor_gap_pct(
                donor, per_worker_fraction
            )
            if projected_gap_pct is not None and projected_gap_pct >= threshold_pct:
                cascade_risk = True
                risk_detail = (
                    f"{donor_id} projected gap: {projected_gap_pct:.1f}% "
                    f"(≥ {threshold_pct:.0f}% threshold)"
                )
                cascade_warnings.append(
                    f"Moving {move['operator_id']} from {donor_id} may create "
                    f"a new bottleneck there (projected gap "
                    f"{projected_gap_pct:.1f}%)"
                )
                if donor_id in donor_backfills:
                    replacement_id, replacement_grade = donor_backfills[donor_id]

        final_moves.append(
            {
                **move,
                "donor_cascade_risk": cascade_risk,
                "donor_risk_detail": risk_detail,
                "donor_replacement_id": replacement_id,
                "donor_replacement_grade": replacement_grade,
            }
        )

    return final_moves, cascade_warnings


def projected_donor_gap_pct(
    donor: dict[str, Any], per_worker_fraction: float
) -> Optional[float]:
    # Without target and actual productivity, the donor risk cannot be estimated.
    targeted = donor.get("targeted_productivity")
    actual = donor.get("actual_productivity")
    if not (targeted and actual and targeted > 0):
        return None

    # Estimate the donor's productivity after losing one worker's configured contribution.
    new_actual = actual - per_worker_fraction
    return max(0.0, (targeted - new_actual) / targeted * 100)
