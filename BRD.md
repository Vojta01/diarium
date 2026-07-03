# Diarium — BRD (Business Requirements Document)

> Náhrada Daylia — open-source, privacy-first denní check-in app s integrací do Obsidian vaultu.
> Poslední aktualizace: 2. 7. 2026

---

## ✅ Hotovo (MVP + rozšíření)

### Check-in (jedna stránka)
- [x] **Nálada** — 5 úrovní (skvěle/dobře/jde to/špatně/hrozně) s barevným odlišením
- [x] **Kvalita spánku** — 3 úrovně (skvělý/normální/špatný)
- [x] **Aktivity** — 8 kategorií podle Daylia (Společenské, Záliby, Spánek, Jídlo, Zdraví, Mé lepší já, Domácí práce, Počasí) vč. mráz
- [x] **Návyky** — toggle pro cvičení, alkohol, meditace, čtení, jídlo, voda, porno, masturbace (s abstinenční logikou)
- [x] **Stres** — 5 úrovní (nízký — extrémní)
- [x] **Vděčnost** — 3 věci, za co jsem vděčný
- [x] **Rychlá poznámka** — volný text
- [x] **Fotka** — z galerie nebo Google Photos
- [x] **Cíle** — přidání/odebrání, denní check, streak počítadlo (🔥 X-denní řada)

### Statistiky
- [x] **Year in Pixels** — heatmapa nálad za celý rok
- [x] **Kalendář** — měsíční přehled s náladami
- [x] **Screen Time** — graf času na mobilu (z Home Assistant)
- [x] **Activity-Mood korelace** — která aktivita koreluje s jakou náladou

### Ukládání
- [x] **GitHub API** — denní zápisy jako YAML frontmatter v Obsidian vaultu
- [x] **Auto-save** — při přepnutí do pozadí, zavření, změně dat (debounce 2s)
- [x] **UTF-8** — správné kódování češtiny (diakritika)
- [x] **Editace** — možnost upravit historický zápis přes `?edit=YYYY-MM-DD`

### PWA
- [x] **Installable** — manifest, service worker, offline cache
- [x] **Vlastní ikona** — měsíček na fialovém gradientu
- [x] **Push notifikace** — denní připomínka ve 21:00 (Web Push + Vercel Cron + Upstash Redis)

### Infrastruktura
- [x] **Next.js 16** na Vercelu (Hobby tier)
- [x] **Zero backend** — vše client-side + GitHub API
- [x] **Dark mode** — konzistentní tmavé UI

---

## 🔜 Zbývá implementovat

### Priorita 1 — Důležité
- [ ] **Hlasové poznámky** — nahrávání audia přímo v appce (jako Daylio)
- [ ] **Procházení historie** — list všech minulých zápisů s vyhledáváním/filtrováním
- [ ] **PIN / otisk prstu** — zamčení appky pro soukromí
- [ ] **Více zápisů denně** — možnost přidat druhý/opravný check-in během dne

### Priorita 2 — Hodilo by se
- [ ] **Export dat** — export do JSON/CSV/PDF mimo GitHub vault
- [ ] **Tmavý/světlý režim** — toggle mezi dark/light theme
- [ ] **Vlastní kategorie aktivit** — uživatel si může přidat/upravit aktivity a kategorie
- [ ] **Vlastní návyky** — možnost přidat/odebrat návyky (ne jen 8 předdefinovaných)
- [ ] **Mood reasons** — možnost označit důvod nálady (práce, vztahy, zdraví…)
- [ ] **Týdenní/měsíční souhrny** — automatický report "Tenhle týden jsi byl nejvíc…"

### Priorita 3 — Nice to have
- [ ] **Integrace počasí** — automatické načtení počasí podle lokace (OpenWeather API)
- [ ] **Grafy nálad v čase** — line chart nálady za poslední měsíc/rok
- [ ] **Tagy** — možnost tagovat zápisy pro lepší filtrování
- [ ] **Šablony cílů** — předdefinované cíle (cvičení, čtení, meditace…)
- [ ] **Notifikace na míru** — vlastní čas připomínky (ne jen 21:00)

---

## 📊 Srovnání s Daylio

| Funkce | Daylio | Diarium |
|---|---|---|
| Nálada (5 úrovní) | ✅ | ✅ |
| Aktivity (kategorie) | ✅ | ✅ |
| Počasí | ✅ | ✅ |
| Stres | ✅ | ✅ |
| Spánek | ✅ | ✅ |
| Návyky | ✅ | ✅ |
| Vděčnost | ✅ | ✅ |
| Poznámka | ✅ | ✅ |
| Fotka | ✅ | ✅ |
| Cíle + streaky | ✅ | ✅ |
| Hlasové poznámky | ✅ | ❌ |
| Statistiky (pixels, kalendář) | ✅ | ✅ |
| Korelace aktivita-nálada | ✅ | ✅ |
| Export dat | ✅ (CSV/PDF) | ❌ |
| PIN zámek | ✅ | ❌ |
| Více zápisů denně | ✅ | ❌ |
| Cloud sync | ✅ (Daylio Sync) | ✅ (GitHub) |
| Cena | ~300 Kč/rok | Zdarma |
| Open source | ❌ | ✅ |
| Data pod tvou kontrolou | ❌ | ✅ (tvůj GitHub) |

---

## 🎯 Co teď?

Doporučuju jako další:
1. **Hlasové poznámky** — v Dayliu to používáš, je to rychlejší než psaní
2. **Procházení historie** — bez toho nemůžeš dohledat staré zápisy
3. **PIN zámek** — pro klid duše, že deník nikdo neotevře

Které z toho chceš jako první?
