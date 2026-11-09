# Polly — Release-Anleitung

## Voraussetzungen

### 1. Docker Hub Zugangsdaten als GitHub Secrets

Im GitHub Repository unter **Settings → Secrets and variables → Actions** müssen zwei Secrets angelegt werden:

| Secret | Beschreibung |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Docker Hub Benutzername (z.B. `manfredsteger`) |
| `DOCKERHUB_TOKEN` | Docker Hub Access Token mit Read/Write-Berechtigung ([hier erstellen](https://hub.docker.com/settings/security)) |

### 2. Arbeitsweise GitHub und GitLab

Entwickelt wird lokal und in GitLab. GitHub enthält nur den veröffentlichten Produktionsstand. **Es gibt keine automatische Synchronisierung**, alles wird von Hand gepusht.

- Gearbeitet wird in Branches. Review und Freigabe laufen über einen Merge Request in GitLab.
- **`main` wird nur auf GitHub gemergt.** In GitLab wird der Merge Request nicht gemergt, sonst laufen die beiden `main` auseinander.
- Nach dem Merge auf GitHub wird `main` von Hand nach GitLab gepusht. GitLab erkennt den Merge Request dann automatisch als gemergt.

---

## Release erstellen

### Ablauf

Der Release-Prozess wird über Git-Tags auf GitHub gesteuert. Sobald dort ein Tag mit dem Prefix `v` gepusht wird, startet die Pipeline automatisch.

```bash
# 0. Remotes: origin = GitHub (Produktion), gitlab = GitLab (Entwicklung)
git fetch origin && git fetch gitlab

# 1. Release-Branch in GitLab fertigstellen: Merge Request reviewen und freigeben, NICHT in GitLab mergen
#    CHANGELOG.md abschließen, Version in package.json + package-lock.json setzen, committen
git push gitlab <branch>

# 2. Fertigen Branch von Hand nach GitHub pushen
git push origin <branch>

# 3. Auf GitHub einen Pull Request <branch> → main öffnen, CI abwarten, mergen

# 4. Tag auf dem gemergten main-Commit setzen und nach GitHub pushen → Pipeline startet
git fetch origin && git switch main && git merge --ff-only origin/main
git tag -a v0.1.0-beta.10 -m "Beta Release 0.1.0-beta.10"
git push origin v0.1.0-beta.10

# 5. GitLab nachziehen, damit beide main und das Tag gleich haben (der GitLab-MR gilt danach als gemergt)
git push gitlab main v0.1.0-beta.10
```

### Was die Pipeline macht

1. **Validate**: TypeScript Check, Übersetzungen validieren, Unit-Tests ausführen, Build prüfen
2. **Docker**: Image bauen und auf Docker Hub pushen
3. **Docker Hub README**: `DOCKERHUB.md` automatisch als Docker Hub Repository-Beschreibung hochladen
4. **GitHub Release**: Release auf GitHub erstellen — der Release-Text übernimmt den passenden Abschnitt aus `CHANGELOG.md` (Fallback: Commit-Liste seit dem letzten Tag) plus taggenauen Quick Start und Vergleichslink; GitHubs automatische "What's Changed"-Notes sind deaktiviert, damit keine doppelten Änderungslisten in Benachrichtigungen landen

### Docker Image Tags

Je nach Versionstyp werden automatisch zusätzliche Tags gesetzt:

| Version | Image Tags |
|---------|-----------|
| `v0.1.0-beta.3` | `manfredsteger/polly:0.1.0-beta.3` + `manfredsteger/polly:beta` |
| `v0.1.0-rc.1` | `manfredsteger/polly:0.1.0-rc.1` + `manfredsteger/polly:rc` |
| `v1.0.0` | `manfredsteger/polly:1.0.0` + `manfredsteger/polly:latest` |

### Manuell (lokal)

Falls die Pipeline nicht genutzt werden soll:

```bash
# Docker Hub Login
docker login

# Image bauen und pushen
make release
# → Fragt nach der Version (z.B. 0.1.0-beta.3)
# → Baut, taggt und pusht automatisch

# Oder mit expliziter Version:
IMAGE_TAG=0.1.0-beta.3 make publish
```

---

## Versionierung

Polly folgt [Semantic Versioning](https://semver.org/):

- **Beta**: `0.x.y-beta.z` — Aktive Entwicklung, API kann sich ändern
- **Release Candidate**: `0.x.y-rc.z` — Feature-vollständig, letzte Tests
- **Stable**: `x.y.z` — Produktionsreif

### Aktuelle Versionsfolge

```
0.1.0-beta.1  →  0.1.0-beta.2  →  0.1.0-beta.3  →  ...  →  0.1.0-rc.1  →  0.1.0
```

---

## Checkliste vor einem Release

- [ ] Merge Request in GitLab reviewt und freigegeben (nicht in GitLab gemergt), GitLab-Pipeline grün
- [ ] Alle Tests bestehen (`make test`)
- [ ] TypeScript kompiliert fehlerfrei (`npx tsc --noEmit`)
- [ ] Übersetzungen vollständig (`make validate-translations`)
- [ ] Docker Build funktioniert lokal (`make build`)
- [ ] `CHANGELOG.md` abgeschlossen (`[Unreleased]` → `[x.y.z] - YYYY-MM-DD`, Version-History-Tabelle aktualisiert)
- [ ] `ROADMAP.md` aktuell (neue Features eingetragen, Release-Timeline ergänzt)
- [ ] `package.json` Version gesetzt (z.B. `0.1.0-beta.3`)
- [ ] `package-lock.json` enthält dieselbe Projektversion wie `package.json`
- [ ] `SELF-HOSTING.md` aktuell
- [ ] `DOCKERHUB.md` aktuell (Versions-Tag-Beispiel, ENV-Vars)
- [ ] Branch nach GitHub gepusht, PR nach `main` gemergt
- [ ] Tag auf dem gemergten `main`-Commit erstellt und nach GitHub gepusht
- [ ] `main` und Tag auch nach GitLab gepusht

---

## Fehlerbehebung

### Pipeline schlägt fehl

1. **Docker Hub Secrets fehlen**: Prüfe unter GitHub Settings → Secrets ob `DOCKERHUB_USERNAME` und `DOCKERHUB_TOKEN` gesetzt sind
2. **Tests schlagen fehl**: Lokal prüfen mit `make test`
3. **Docker Build Fehler**: Lokal prüfen mit `make build`

### Tag oder Image existiert bereits

Veröffentlichte Versions-Tags sind unveränderlich. Einen bestehenden Tag oder
ein versioniertes Docker-Image nicht überschreiben; stattdessen die nächste
freie Beta-Version verwenden. Nur die beweglichen Kanal-Tags (`beta`, `rc`,
`latest`) werden von der Pipeline aktualisiert.
