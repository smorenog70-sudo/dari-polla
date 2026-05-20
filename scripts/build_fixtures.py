"""Build fixtures.json for the app from openfootball raw data."""
import json
import re
from datetime import datetime, timedelta, timezone

# Translate to Spanish (matching the Excel)
TEAM_ES = {
    "Mexico": "México",
    "South Africa": "Sudáfrica",
    "South Korea": "Corea del Sur",
    "Canada": "Canadá",
    "Qatar": "Catar",
    "Switzerland": "Suiza",
    "Brazil": "Brasil",
    "Morocco": "Marruecos",
    "Haiti": "Haití",
    "Scotland": "Escocia",
    "USA": "Estados Unidos",
    "Paraguay": "Paraguay",
    "Australia": "Australia",
    "Germany": "Alemania",
    "Curaçao": "Curazao",
    "Ivory Coast": "Costa de Marfil",
    "Ecuador": "Ecuador",
    "Netherlands": "Holanda",
    "Japan": "Japón",
    "Tunisia": "Túnez",
    "Belgium": "Bélgica",
    "Egypt": "Egipto",
    "Iran": "Irán",
    "New Zealand": "Nueva Zelanda",
    "Spain": "España",
    "Cape Verde": "Cabo Verde",
    "Saudi Arabia": "Arabia",
    "Uruguay": "Uruguay",
    "France": "Francia",
    "Senegal": "Senegal",
    "Norway": "Noruega",
    "Argentina": "Argentina",
    "Algeria": "Algeria",
    "Austria": "Austria",
    "Jordan": "Jordan",
    "Portugal": "Portugal",
    "Uzbekistan": "Uzbekistán",
    "Colombia": "Colombia",
    "England": "Inglaterra",
    "Croatia": "Croacia",
    "Ghana": "Ghana",
    "Panama": "Panamá",
}

# Map qualification path placeholders to the Excel team for the polla
# (Excel was made before the playoffs concluded; we lock these to the Excel's choices)
PLACEHOLDER_MAP = {
    "UEFA Path D winner": "República Checa",  # in Group A per Excel
    "UEFA Path A winner": "Bosnia",            # in Group B per Excel
    "UEFA Path B winner": "Suecia",            # in Group F per Excel
    "UEFA Path C winner": "Turquía",           # in Group D per Excel
    "IC Path 1 winner": "Congo",               # in Group K per Excel
    "IC Path 2 winner": "Iraq",                # in Group I per Excel
}


def normalize_team(name: str) -> str:
    if name in PLACEHOLDER_MAP:
        return PLACEHOLDER_MAP[name]
    return TEAM_ES.get(name, name)


def parse_kickoff(date_str: str, time_str: str) -> str:
    """Convert '2026-06-11' + '13:00 UTC-6' to ISO-8601 UTC string."""
    m = re.match(r"(\d{2}):(\d{2})(?:\s+UTC([+-]\d+))?", time_str)
    if not m:
        return None
    hh, mm, off = int(m.group(1)), int(m.group(2)), m.group(3)
    offset_hours = int(off) if off else 0
    # Local time at venue. UTC = local - offset.
    local_naive = datetime.strptime(f"{date_str} {hh:02d}:{mm:02d}", "%Y-%m-%d %H:%M")
    utc_dt = local_naive - timedelta(hours=offset_hours)
    return utc_dt.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")


def main():
    with open("/tmp/fixtures_raw.json", "r", encoding="utf-8") as f:
        raw = json.load(f)

    # Map "Matchday N" → Jornada de fase de grupos (1, 2 o 3)
    # Per the fixture, each group plays MD1-MD17 spread across days
    # but every group plays exactly 3 matches per "fecha" (date 1, 2, 3).
    # We compute fecha per group: 1st pair = fecha1, 2nd pair = fecha2, 3rd = fecha3.
    group_match_idx = {}
    matches = []
    for idx, m in enumerate(raw["matches"]):
        round_name = m["round"]
        group = m.get("group")
        team1 = normalize_team(m["team1"])
        team2 = normalize_team(m["team2"])
        kickoff = parse_kickoff(m["date"], m["time"])

        match_id = None
        fecha = None
        stage = None

        if round_name.startswith("Matchday") and group:
            stage = "group"
            grp_letter = group.replace("Group ", "")
            group_match_idx.setdefault(grp_letter, 0)
            count = group_match_idx[grp_letter]
            # 0,1 → fecha 1; 2,3 → fecha 2; 4,5 → fecha 3
            fecha = (count // 2) + 1
            group_match_idx[grp_letter] = count + 1
            match_id = f"G{grp_letter}-F{fecha}-{(count % 2) + 1}"
        elif round_name == "Round of 32":
            stage = "r32"
            num = m.get("num", idx)
            match_id = f"R32-{num}"
        elif round_name == "Round of 16":
            stage = "r16"
            num = m.get("num", idx)
            match_id = f"R16-{num}"
        elif round_name == "Quarter-final":
            stage = "qf"
            num = m.get("num", idx)
            match_id = f"QF-{num}"
        elif round_name == "Semi-final":
            stage = "sf"
            num = m.get("num", idx)
            match_id = f"SF-{num}"
        elif round_name == "Match for third place":
            stage = "third"
            match_id = "THIRD"
        elif round_name == "Final":
            stage = "final"
            match_id = "FINAL"

        matches.append({
            "id": match_id,
            "stage": stage,
            "group": group.replace("Group ", "") if group else None,
            "fecha": fecha,
            "round": round_name,
            "team1": team1,
            "team2": team2,
            "team1_raw": m["team1"],
            "team2_raw": m["team2"],
            "kickoff_utc": kickoff,
            "ground": m.get("ground"),
        })

    # Build groups
    groups = {}
    for letter in "ABCDEFGHIJKL":
        groups[letter] = []
    for m in matches:
        if m["stage"] == "group":
            for t in (m["team1"], m["team2"]):
                if t not in groups[m["group"]]:
                    groups[m["group"]].append(t)

    out = {
        "tournament": "World Cup 2026",
        "matches": matches,
        "groups": groups,
    }
    with open("/home/claude/dari-polla/src/data/fixtures.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(matches)} matches.")
    print("Groups:")
    for k, v in groups.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
