from src.predict import predict_batch

current_row = {
    "department": "sewing",
    "day": "Thursday",
    "team": 8,
    "targeted_productivity": 0.8,
    "smv": 26.16,
    "wip": 1108,
    "over_time": 7080,
    "incentive": 98,
    "idle_time": 0,
    "idle_men": 0,
    "no_of_style_change": 0,
    "no_of_workers": 59,
    "month": 1,
    "day_of_month": 1
}

result = predict_batch(current_row, batch_qty=1000)
print(result)