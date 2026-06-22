# Polly — Release-Anleitung

## Voraussetzungen

### 1. Docker Hub Zugangsdaten als GitHub Secrets

Im GitHub Repository unter **Settings → Secrets and variables → Actions** müssen zwei Secrets angelegt werden:

| Secret | Beschreibung |
|--------|-------------|
| `DOCKERHUB_USERNAME` | Docker Hub Benutzername (z.B. `manfredsteger`) |
| `DOCKERHUB_TOKEN` | Docker Hub Access Token mit Read/Write-Berechtigung ([hier erstellen](https://hub.docker.com/settings/security)) |

### 2. GitLab Mirror (optional)

Für automatisches Tag-Mirroring zu GitLab:

| Secret | Beschreibung |
|--------|-------------|
| `GITLAB_TOKEN` | GitLab Personal Access Token mit `write_repository` Berechtigung |

---

## Release erstellen

### Automatisch (empfohlen)

Der Release-Prozess wird über Git-Tags gesteuert. Sobald ein Tag mit dem Prefix `v` gepusht wird, startet die Pipeline automatisch.

```bash
# 1. Sicherstellen, dass der aktive Branch release ist
git branch  # → muss "release" zeigen

# 2. CHANGELOG.md: [Unreleased] → [0.1.0-beta.3] - YYYY-MM-DD, Version-History aktualisieren
git add CHANGELOG.md
git commit -m "chore: prepare CHANGELOG for v0.1.0-beta.3"
git push origin release

# 3. Version in package.json auf die neue Version setzen, committen
#    (package.json → "version": "0.1.0-beta.3")
git add package.json
git commit -m "chore: bump version to 0.1.0-beta.3"
git push origin release

# 4. release → main mergen (nur du als Benutzer, niemals der Agent!)
git checkout main
git pull origin main
git merge --no-ff release -m "Merge release into main for v0.1.0-beta.3"
git push origin main

# 5. Tag auf main erstellen
git tag -a v0.1.0-beta.3 -m "Beta Release 0.1.0-beta.3"

# 6. Tag pushen → Pipeline startet automatisch
git push origin v0.1.0-beta.3
```

### Was die Pipeline macht

1. **Validate**: TypeScript Check, Übersetzungen validieren, Unit-Tests ausführen, Build prüfen
2. **Docker**: Image bauen und auf Docker Hub pushen
3. **Docker Hub README**: `DOCKERHUB.md` automatisch als Docker Hub Repository-Beschreibung hochladen
4. **GitHub Release**: Release mit Changelog auf GitHub erstellen
5. **GitLab Mirror**: Tags automatisch zu GitLab spiegeln

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

- [ ] Aktiver Branch ist `release` (`git branch` prüfen)
- [ ] `git pull origin release` — lokaler Stand aktuell
- [ ] Alle Tests bestehen (`make test`)
- [ ] TypeScript kompiliert fehlerfrei (`npx tsc --noEmit`)
- [ ] Übersetzungen vollständig (`make validate-translations`)
- [ ] Docker Build funktioniert lokal (`make build`)
- [ ] `CHANGELOG.md` abgeschlossen (`[Unreleased]` → `[x.y.z] - YYYY-MM-DD`, Version-History-Tabelle aktualisiert)
- [ ] `ROADMAP.md` aktuell (neue Features eingetragen, Release-Timeline ergänzt)
- [ ] `package.json` Version gesetzt (z.B. `0.1.0-beta.3`)
- [ ] `SELF-HOSTING.md` aktuell
- [ ] `DOCKERHUB.md` aktuell (Versions-Tag-Beispiel, ENV-Vars)
- [ ] `release` → `main` gemergt (nur manuell durch den Benutzer!)
- [ ] Tag auf `main` erstellt und gepusht

---

## Fehlerbehebung

### Pipeline schlägt fehl

1. **Docker Hub Secrets fehlen**: Prüfe unter GitHub Settings → Secrets ob `DOCKERHUB_USERNAME` und `DOCKERHUB_TOKEN` gesetzt sind
2. **Tests schlagen fehl**: Lokal prüfen mit `make test`
3. **Docker Build Fehler**: Lokal prüfen mit `make build`

### Image existiert bereits

Docker Hub erlaubt das Überschreiben bestehender Tags. Falls ein Tag nochmal gepusht werden soll:

```bash
# Tag lokal löschen und neu erstellen
git tag -d v0.1.0-beta.3
git push origin :refs/tags/v0.1.0-beta.3
git tag -a v0.1.0-beta.3 -m "Beta Release 0.1.0-beta.3 (fixed)"
git push origin v0.1.0-beta.3
```
