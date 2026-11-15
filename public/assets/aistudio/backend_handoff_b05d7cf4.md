# Backend Team Specification — Mascu-Skeletal Diagnosis

This standalone Markdown specification covers everything the backend team needs to build and connect to the frontend (`index.html`).

---

## System Architecture

```
Pure HTML/CSS/JS Frontend (index.html)
   │
   ├── 00. Sign In           ──▶ /api/auth/* & /api/users/me
   ├── 01. My Skeleton       ──▶ /api/crew/*
   ├── 02. Coach AI-Model    ──▶ /predict -> Flask (Port 5000) -> Google Colab Ngrok AI
   └── 03. Doctors Review    ──▶ /api/reviews/*
```

---

## 00. Authentication & User Profiles

Frontend markers in `index.html` (`// TODO(backend):` comments):
- `POST /api/auth/signin`
- `POST /api/auth/register`
- `POST /api/auth/oauth/google`
- `POST /api/auth/signout`
- `GET /api/users/me` & `PUT /api/users/me`

### Request & Response Payloads

**Sign In (`POST /api/auth/signin`)**
```json
{
  "accountRole": "astronaut",
  "email": "vance@mission.org",
  "password": "user-password"
}
```

**Register (`POST /api/auth/register`)**
```json
{
  "accountRole": "doctor",
  "displayName": "Dr. Aris Thorne",
  "callsign": "MED-402",
  "email": "thorne@orbital-med.org",
  "password": "strong-password",
  "specialty": "Flight Surgeon",
  "missionName": "Expedition 74"
}
```

**Session Response (`200 OK`)**
```json
{
  "token": "<jwt-or-session-token>",
  "user": {
    "id": "usr_01",
    "accountRole": "astronaut",
    "displayName": "Elena Vance",
    "callsign": "Vance-01",
    "email": "vance@mission.org",
    "specialty": "Mission Commander",
    "missionName": "Expedition 74",
    "createdAt": "2026-11-13T04:00:00Z",
    "updatedAt": "2026-11-13T04:00:00Z"
  }
}
```

**Valid `specialty` Values**
- Astronaut: `"Mission Commander"`, `"Flight Engineer"`, `"Payload Specialist"`
- Doctor: `"Flight Surgeon"`, `"Orthopedic Specialist"`

---

## 01. My Skeleton (Bone Density Telemetry)

- `GET /api/crew` (or `/api/skeleton/me`)
- `POST /api/crew/:id/scans`

**Skeletal Record Schema**
```json
{
  "id": "crew_01",
  "name": "Elena Vance",
  "callsign": "Vance-01",
  "specialty": "Mission Commander",
  "missionDays": 142,
  "status": "monitoring",
  "overallTScore": -1.4,
  "regions": [
    {
      "regionId": "femoral_neck",
      "label": "Femoral Neck",
      "bmdGcm2": 0.78,
      "tScore": -1.6,
      "zScore": -1.2,
      "monthlyLossPct": 1.3
    },
    {
      "regionId": "tibia_shaft",
      "label": "Tibia Shaft",
      "bmdGcm2": 0.84,
      "tScore": -1.8,
      "zScore": -1.4,
      "monthlyLossPct": 1.5
    }
  ],
  "updatedAt": "2026-11-13T04:00:00Z"
}
```

---

## 02. Coach AI-Model & Colab Ngrok Bridge

Proxy file: `backend/app.py` (Flask on port `5000`, proxied from Vite `/predict`).

**Endpoint**: `POST /predict` -> forwards to `COLAB_API_URL` (`https://YOUR-NGROK-URL.ngrok-free.app/predict-colab`)

**Request Payload**
```json
{
  "sos": 1512.0,
  "bua": 59.0
}
```
- `sos`: Speed of Sound ($\text{m/s}$)
- `bua`: Broadband Ultrasound Attenuation ($\text{dB/MHz}$)

**Expected Colab AI Response (`200 OK`)**
```json
{
  "prediction": "Osteopenia",
  "confidence": 0.91,
  "t_score": -1.6,
  "recommendation": "Increase ARED lower-body axial loading and maintain 1200 mg/day calcium intake."
}
```

**Run Locally**
```bash
pip install -r backend/requirements.txt
export COLAB_API_URL="https://YOUR-ACTIVE-NGROK-URL.ngrok-free.app/predict-colab"
python backend/app.py
```

---

## 03. Doctors Review (Physician Sign-Off & Clearance)

- `GET /api/reviews` — Astronauts read only their own reviews; Doctors read assigned crew reviews.
- `PATCH /api/reviews/:reviewId` — Doctor-only endpoint (`403 Forbidden` for Astronauts).

**Update Payload (`PATCH /api/reviews/:reviewId`)**
```json
{
  "clearanceStatus": "cleared_for_eva",
  "clinicalNotes": "T-score stabilized after 4 weeks of resistive protocol.",
  "prescribedIntervention": "Continue baseline ARED schedule."
}
```

**Supported `clearanceStatus` Values**
- `"pending"`
- `"intervention_required"`
- `"cleared_for_eva"`
