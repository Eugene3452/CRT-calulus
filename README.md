# CRT · Guyon-Massonnet

Application de calcul des **coefficients de répartition transversale** (CRT) d’un pont à poutres multiples par la méthode de **Guyon-Massonnet**. Elle traite les chargeurs **AL**, **qtr**, **Bc** et **Mc** et produit une note de calcul imprimable.

L’outil reprend la démarche de l’exercice de cours joint (`ilide.info-exercice-crt-guyon-massonnet-…pdf`) : section en T, rigidités équivalentes, paramètres `T` et `D`, tables de Massonnet `K₀`/`K₁`, interpolation en `√D`, puis optimisation transversale de chaque chargement.

## Lancer l’application

Aucune dépendance, aucun build. Un simple serveur statique suffit :

```bash
node server.mjs          # http://127.0.0.1:4173
# ou
python3 -m http.server 4173
```

Ouvrir ensuite <http://127.0.0.1:4173>. L’application fonctionne entièrement dans le navigateur ; les paramètres et la vue courante sont conservés dans `localStorage`.

## Fonctionnalités

- **Saisie en direct** de la géométrie du tablier, de la section de poutre et des chargeurs, avec validation et messages d’erreur.
- **Deux modes de calcul** :
  - `tables` (par défaut) : triple interpolation du cours — sur `y`, puis sur `D` via `√D`, puis sur `T` ;
  - `exact` : résolution directe de la plaque orthotrope équivalente.
- **Chargements** :
  - **AL** : bande répartie glissée sur la largeur chargeable, coefficient `a₁` selon la classe du pont ;
  - **qtr** : trottoir gauche, droit ou les deux ;
  - **Bc** : files de deux roues (2,00 m), entraxe et garde paramétrables, coefficient `bc` ;
  - **Mc80 / Mc120** : convoi à deux chenilles, position optimisée.
- **Optimisation transversale** au pas de 1 cm pour chaque chargeur, sur chacune des poutres.
- **Cinq vues** : synthèse, ligne d’influence interactive, détail des chargements, tables de Massonnet (heatmap + export CSV), méthode et validation.
- **Note de calcul** imprimable (A4) via « Imprimer / PDF ».

## Méthode

1. **Rigidités** de la section en T :
   `Up = Ip / b₀`, `Ue = hd³ / 12`, `Jp = Kp / 2b₀`, `Je = Ue`.
2. **Paramètres adimensionnels** :
   `T = (b / Lc) · (Up / Ue)^(1/4)` et `D = (Jp + Je) / (2√(Up·Ue))`, avec `b = n·b₀/2`.
3. **Coefficients de plaque** :
   `Kα = K₀ + (K₁ − K₀)·√D`, `K₀` sans torsion, `K₁` avec torsion maximale.
4. **Répartition** :
   - `AL` : `δ = a₁ · LAl · K̄ / n` ;
   - `qtr` : `η = K̄tr / n` ;
   - `Bc` : `δ = bc · K̄Bc / n`, avec `K̄Bc = ½ Σ K(e_i)` sur les quatre roues ;
   - `Mc` : `δ = K̄Mc / n`, avec `K̄Mc = ¼ Σ K(e_i)` aux quatre bords de chenilles.
5. **Enveloppe** sur toutes les poutres, puis application aux sollicitations dans les combinaisons ELU / ELS.

### Tables de Massonnet

Les tables `K₀`/`K₁` ne sont pas des images scannées : elles sont recalculées par résolution de l’équation de la plaque orthotrope (bords longitudinaux libres, appuis simples aux extrémités), pour la charge sinusoïdale transversale. La grille du cours est reproduite : `y/b = 0…1` et `e/b = −1…1` par pas de 0,25, `T` de 0,05 à 2,00.

Le moteur a été contrôlé sur les valeurs de l’exercice : les **72 valeurs** de `K₀` et `K₁` aux tables `T = 1,10` et `T = 1,20` coïncident à **10⁻⁴** près. Les CRT de l’exemple sont reproduits avec un écart de quelques pour cent ; l’écart sur `Bc` (P1) provient de l’optimisation transversale, qui explore des positions plus défavorables que le placement manuel du cours.

## Structure

```
index.html          structure de l’application
styles.css          design system, responsive, impression
src/engine.js       moteur : plaque, tables, section, chargements
src/charts.js       coupe transversale, section, ligne d’influence (SVG)
src/views.js        rendu HTML des cinq vues
src/icons.js        icônes SVG
src/app.js          état, formulaire, navigation, interactions
server.mjs          serveur statique local (sans dépendance)
```

## Exemple préchargé

L’exemple du cours est actif au premier lancement : `Lc = 15,36 m`, `n = 5`, `b₀ = 2,50 m`, `Ltr = 1,50 m`, poutre `0,30 × 1,00 m`, hourdis `0,16 m`, table `2,50 m`. Il donne `T ≈ 1,149`, `D ≈ 0,372`, avec `AL ≈ 1,39`, `qtr ≈ 0,73`, `Bc ≈ 0,62` et `Mc ≈ 0,36` pour la poutre de rive P1.

## Limites

Outil de **prédimensionnement** destiné à l’étude de ponts à poutres parallèles, en comportement élastique linéaire. Les effets locaux de la dalle, le fluage, la précontrainte, les combinaisons réglementaires complètes et les vérifications de résistance restent à la charge de l’ingénieur. Le domaine usuel est `0 ≤ D ≤ 1` et `0,05 ≤ T ≤ 2,00`.

## Références

- Guyon Y. (1946), *Calcul des ponts larges à poutres multiples solidarisées par des entretoises*.
- Massonnet C. (1950), *Méthode de calcul des ponts à poutres multiples*.
- Massonnet C., Bareš R. (1966), *Calcul des ponts à poutres multiples*, Dunod.
- NF EN 1991-2 — charges de circulation sur les ponts.
