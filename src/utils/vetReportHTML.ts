// Kiba — M6 Vet Report HTML Template
// Pure function: VetReportData → HTML string for expo-print.
// 4-page US Letter layout. Inline CSS only. Monochrome-friendly.
// D-095 UPVM compliant: all copy is observational, never prescriptive.

import type {
  VetReportData,
  VetReportDietItem,
  CombinedNutrition,
  SupplementNutrient,
  VetReportFlag,
  ConditionNote,
  WeightTrackingData,
  TreatSummary,
  OwnerDietaryCard,
  ConflictNote,
} from '../types/vetReport';
import type { PetMedication } from '../types/pet';
import type { Appointment, PetHealthRecord } from '../types/appointment';
import { stripBrandFromName } from './formatters';

// ─── Main Export ────────────────────────────────────────

export function generateVetReportHTML(data: VetReportData): string {
  const pages = [
    renderPage1(data),
    renderPage2(data),
    renderPage3(data),
  ];

  // Page 4 only if conditions or allergens exist
  if (data.conditionTags.length > 0 || data.allergens.length > 0) {
    pages.push(renderPage4(data));
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vet Diet Report — ${data.pet.name}</title>
  <style>${globalStyles()}</style>
</head>
<body>
  ${pages.join('\n')}
</body>
</html>`;
}

// ─── Global Styles ──────────────────────────────────────

function globalStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 10px; color: #1a1a1a; line-height: 1.4; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { width: 8.5in; min-height: 11in; padding: 0.5in 0.6in; page-break-after: always; position: relative; }
    .page:last-child { page-break-after: auto; }
    h1 { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
    h2 { font-size: 12px; font-weight: 700; margin: 0; padding: 5px 10px; background: #d0d0d0; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #aaa; }
    h3 { font-size: 11px; font-weight: 600; margin: 8px 0 4px; }
    table { width: 100%; border-collapse: collapse; margin: 4px 0; }
    th, td { padding: 3px 6px; text-align: left; font-size: 9px; border-bottom: 0.5px solid #ddd; }
    th { background: #f5f5f5; font-weight: 600; font-size: 8px; text-transform: uppercase; letter-spacing: 0.3px; }
    .subtitle { font-size: 11px; color: #555; margin-bottom: 8px; }
    .meta { font-size: 8px; color: #888; }
    .tag { display: inline-block; background: #f0f0f0; border-radius: 3px; padding: 1px 5px; font-size: 8px; margin: 1px 2px; }
    .flag-row { display: flex; align-items: flex-start; margin: 3px 0; }
    .flag-icon { font-size: 12px; margin-right: 6px; flex-shrink: 0; }
    .flag-label { font-size: 8px; font-weight: 700; margin-right: 6px; min-width: 60px; }
    .flag-msg { font-size: 9px; flex: 1; }
    .section { page-break-inside: avoid; margin-bottom: 10px; }
    .bordered-section { border: 1.5px solid #999; padding: 0; margin: 14px 0 10px; page-break-inside: avoid; overflow: hidden; }
    .bordered-section > :not(h2) { margin-left: 10px; margin-right: 10px; }
    .bordered-section > :last-child { margin-bottom: 8px; }
    .bordered-section > h2 { margin: 0; border-top: none; }
    .bordered-section table { width: calc(100% - 20px); margin-left: 10px; margin-right: 10px; }
    .card { border: 1px solid #ccc; border-radius: 4px; padding: 8px 10px; margin: 6px 0; page-break-inside: avoid; }
    .card-title { font-size: 11px; font-weight: 700; margin-bottom: 4px; }
    .card-field { font-size: 9px; margin: 3px 0; }
    .card-field strong { font-weight: 600; }
    .conflict-box { background: #FFFDE7; border: 1px solid #FDD835; border-radius: 4px; padding: 6px 10px; margin: 6px 0; font-size: 9px; page-break-inside: avoid; }
    .conflict-icon { font-size: 12px; margin-right: 4px; }
    .footer { position: absolute; bottom: 0.4in; left: 0.6in; right: 0.6in; font-size: 8px; color: #888; border-top: 0.5px solid #ddd; padding-top: 4px; }
    .footer a { color: #999; text-decoration: none; }
    .ruled-line { border-bottom: 1px solid #ccc; height: 20px; margin: 4px 0; }
    .bcs-gauge { display: flex; width: 100%; position: relative; margin: 6px 0 2px; }
    .bcs-segment { text-align: center; padding: 4px 0; font-size: 8px; font-weight: 600; border: 1px solid #ccc; }
    .bcs-labels { display: flex; font-size: 7px; color: #666; margin-bottom: 4px; }
    .bcs-marker { position: absolute; top: -10px; font-size: 12px; transform: translateX(-50%); }
    .check { color: #2E7D32; }
    .fail { color: #C62828; }
    .two-col { display: flex; gap: 16px; }
    .two-col > div { flex: 1; }
    .bcs-cell { flex:1; text-align:center; padding:5px 0; font-size:9px; border:1px solid #999; }
    .bcs-uw { background-color: #FFE082 !important; }
    .bcs-ideal { background-color: #A5D6A7 !important; }
    .bcs-ow { background-color: #FFCC80 !important; }
    .bcs-ob { background-color: #EF9A9A !important; }
    .bcs-active { border: 2.5px solid #333 !important; font-weight: 800 !important; }
    @media print { .page { page-break-after: always; } }
  `;
}

// ─── Page 1: Pet Profile + BCS + Medications + Diet ─────

function renderPage1(data: VetReportData): string {
  const { pet, weightTracking, medications, dietItems, adjustedDER, caloricBalance, treatSummary } = data;
  const ageStr = pet.date_of_birth ? formatAge(pet.date_of_birth) : 'Unknown';
  const breedStr = pet.breed ?? 'Unknown breed';
  const speciesStr = pet.species === 'dog' ? 'Dog' : 'Cat';
  const weightStr = pet.weight_current_lbs ? `${pet.weight_current_lbs} lbs` : 'Not recorded';
  const neuteredStr = pet.is_neutered ? 'Yes' : 'No';
  const bcsStr = weightTracking.bcsScore != null
    ? `${weightTracking.bcsScore}/9${weightTracking.bcsDate ? ` (assessed ${formatDate(weightTracking.bcsDate)})` : ''}`
    : 'Not assessed';
  const totalDailyKcal = dietItems.reduce((s, d) => s + d.dailyKcal, 0);

  // Current + past medications
  const currentMeds = medications.filter(m => m.status === 'current');
  const pastMeds = medications.filter(m => m.status === 'past');

  return `<div class="page">
    <div style="text-align:center; margin-bottom:14px;">
      <div style="font-size:18px; font-weight:700; letter-spacing:0.5px;">KIBA — Diet Report for ${esc(pet.name)}</div>
      <div style="font-size:10px; color:#555;">Generated: ${formatDate(data.generatedAt)}</div>
    </div>

    <div class="bordered-section">
      <h2>Pet Profile</h2>
      <table>
        <tr>
          <td style="width:15%;"><strong>Name:</strong></td><td style="width:35%;">${esc(pet.name)}</td>
          <td style="width:15%;"><strong>Weight:</strong></td><td style="width:35%;">${weightStr}</td>
        </tr>
        <tr>
          <td><strong>Species:</strong></td><td>${speciesStr}</td>
          <td><strong>Activity:</strong></td><td>${pet.activity_level}</td>
        </tr>
        <tr>
          <td><strong>Breed:</strong></td><td>${esc(breedStr)}</td>
          <td><strong>Neutered:</strong></td><td>${neuteredStr}</td>
        </tr>
        <tr>
          <td><strong>Age:</strong></td><td>${ageStr}</td>
          <td><strong>BCS:</strong></td><td>${bcsStr}</td>
        </tr>
        ${weightTracking.goalLabel !== 'Maintain' ? `<tr>
          <td></td><td></td>
          <td><strong>Weight Goal:</strong></td><td>${esc(weightTracking.goalLabel)}</td>
        </tr>` : ''}
      </table>

      ${renderBCSGauge(weightTracking)}

      ${data.conditionTags.length > 0 ? `
      <div style="margin-top:6px;">
        <strong style="font-size:9px;">Health Conditions:</strong>
        <ul style="margin:2px 0 0 16px; font-size:9px;">
          ${data.conditionTags.map(t => `<li>${esc(formatConditionLabel(t))}</li>`).join('')}
        </ul>
      </div>` : ''}

      ${data.allergens.length > 0 ? `
      <div style="margin-top:4px;">
        <strong style="font-size:9px;">Allergens:</strong>
        <ul style="margin:2px 0 0 16px; font-size:9px;">
          ${data.allergens.map(a => `<li>${esc(a)}</li>`).join('')}
        </ul>
      </div>` : ''}
    </div>

    ${medications.length > 0 ? `
    <div class="section">
      <h2>Medications</h2>
      ${currentMeds.length > 0 ? `
      <div style="font-size:9px; margin-bottom:4px;">
        <strong>Current:</strong>
        <ul style="margin:2px 0 0 16px;">
          ${currentMeds.map(m => `<li>${esc(m.medication_name)}${m.dosage ? ` — ${esc(m.dosage)}` : ''}${m.prescribed_for ? ` (for: ${esc(m.prescribed_for)})` : ''}</li>`).join('')}
        </ul>
      </div>` : ''}
      ${pastMeds.length > 0 ? `
      <div style="font-size:9px;">
        <strong>Past:</strong>
        <ul style="margin:2px 0 0 16px;">
          ${pastMeds.map(m => `<li>${esc(m.medication_name)}${m.dosage ? ` — ${esc(m.dosage)}` : ''}${m.ended_at ? ` (ended ${formatDate(m.ended_at)})` : ''}</li>`).join('')}
        </ul>
      </div>` : ''}
    </div>` : ''}

    <div class="bordered-section">
      <h2>Current Diet</h2>
      <div style="font-size:9px; margin:6px 10px;">
        <strong>Daily Caloric Intake:</strong> ~${totalDailyKcal.toLocaleString()} kcal/day<br>
        ${adjustedDER > 0 ? `<strong>Adjusted DER (${esc(weightTracking.goalLabel.toLowerCase())}):</strong> ~${adjustedDER.toLocaleString()} kcal/day<br>` : ''}
        ${adjustedDER > 0 ? `<strong>Caloric Balance:</strong> ${caloricBalance > 0 ? '+' : ''}${caloricBalance} kcal/day ${caloricBalance > 0 ? 'over' : caloricBalance < 0 ? 'under' : 'at'} target` : ''}
      </div>
      <table>
        <tr><th>Product</th><th>Form</th><th>Serving</th><th>kcal/day</th></tr>
        ${dietItems.map(d => `
          <tr${d.isRecalled ? ' style="background:#FFEBEE;"' : ''}>
            <td>${esc(stripBrandFromName(d.brand, d.productName))}</td>
            <td>${d.form}</td>
            <td>${esc(d.servingDisplay)}</td>
            <td>${d.dailyKcal > 0 ? d.dailyKcal : '—'}</td>
          </tr>
        `).join('')}
        ${treatSummary && treatSummary.avgDailyKcal != null ? `
        <tr>
          <td>Treats (avg)</td>
          <td>Treat</td>
          <td>~${treatSummary.avgDailyCount}/day</td>
          <td>~${treatSummary.avgDailyKcal}</td>
        </tr>` : ''}
      </table>
      ${caloricBalance > 0 && adjustedDER > 0 ? `
      <div style="font-size:9px; margin-top:4px; color:#E65100;">
        ⚠ Caloric intake exceeds adjusted target by ~${Math.round((caloricBalance / adjustedDER) * 100)}%
      </div>` : ''}
    </div>

    ${renderFooter(1, true)}
  </div>`;
}

// ─── BCS Gauge ──────────────────────────────────────────

function renderBCSGauge(wt: WeightTrackingData): string {
  if (wt.bcsScore == null) {
    return '';
  }

  const score = Math.max(1, Math.min(9, wt.bcsScore));
  const category = score <= 3 ? 'Underweight' : score <= 5 ? 'Ideal' : score <= 7 ? 'Overweight' : 'Obese';
  const dateStr = wt.bcsDate ? formatDate(wt.bcsDate) : 'date unknown';

  // Color classes per segment: 1-3 underweight, 4-5 ideal, 6-7 overweight, 8-9 obese
  const colorClasses = ['bcs-uw','bcs-uw','bcs-uw','bcs-ideal','bcs-ideal','bcs-ow','bcs-ow','bcs-ob','bcs-ob'];

  const cells = Array.from({ length: 9 }, (_, i) => {
    const n = i + 1;
    const active = n === score ? ' bcs-active' : '';
    return `<div class="bcs-cell ${colorClasses[i]}${active}">${n}</div>`;
  }).join('');

  // Marker row
  const markers = Array.from({ length: 9 }, (_, i) =>
    `<div style="flex:1; text-align:center; font-size:11px; height:14px;">${i + 1 === score ? '▼' : ''}</div>`
  ).join('');

  return `
    <div style="margin:8px 10px 4px;">
      <strong style="font-size:9px;">BODY CONDITION SCORE</strong>
      <div style="display:flex; margin-top:4px;">${markers}</div>
      <div style="display:flex;">${cells}</div>
      <div style="display:flex; margin-top:1px;">
        <div style="flex:3; text-align:center; font-size:7px; color:#666;">Underweight</div>
        <div style="flex:2; text-align:center; font-size:7px; color:#666;">Ideal</div>
        <div style="flex:2; text-align:center; font-size:7px; color:#666;">Overweight</div>
        <div style="flex:2; text-align:center; font-size:7px; color:#666;">Obese</div>
      </div>
      <div style="font-size:9px; text-align:center; margin-top:3px;">BCS: ${score}/9 — ${category} (assessed ${dateStr})</div>
    </div>`;
}

// ─── Page 2: Nutrition + Supplements + Flags + Weight ────

function renderPage2(data: VetReportData): string {
  const { combinedNutrition, supplementNutrients, flags, weightTracking } = data;
  const speciesLabel = data.pet.species === 'dog' ? 'dogs' : 'cats';

  // Build AAFCO lookup for unified table
  const aafcoMap = new Map(combinedNutrition.aafcoChecks.map(c => [c.nutrient, c]));

  return `<div class="page">
    <h2>Combined Nutritional Profile</h2>
    <div class="section">
      <div class="meta" style="margin-bottom:4px;">Weighted average across all daily foods, by caloric contribution.</div>
      <table>
        <tr><th>Nutrient</th><th>As-Fed</th><th>DMB</th><th>AAFCO Adult</th></tr>
        ${renderUnifiedNutrientRow('Protein (min)', combinedNutrition.proteinAsFed, combinedNutrition.proteinDmb, aafcoMap.get('Protein'))}
        ${renderUnifiedNutrientRow('Fat (min)', combinedNutrition.fatAsFed, combinedNutrition.fatDmb, aafcoMap.get('Fat'))}
        ${renderUnifiedNutrientRow('Fiber (max)', combinedNutrition.fiberAsFed, combinedNutrition.fiberDmb, undefined)}
        ${renderUnifiedNutrientRow('Moisture', combinedNutrition.moistureAsFed, null, undefined)}
        ${renderUnifiedNutrientRow('Calcium', combinedNutrition.calciumAsFed, combinedNutrition.calciumDmb, aafcoMap.get('Calcium'))}
        ${renderUnifiedNutrientRow('Phosphorus', combinedNutrition.phosphorusAsFed, combinedNutrition.phosphorusDmb, aafcoMap.get('Phosphorus'))}
        <tr><td><strong>kcal/kg</strong></td><td>${combinedNutrition.kcalPerKg != null ? Math.round(combinedNutrition.kcalPerKg).toLocaleString() : '—'}</td><td>${combinedNutrition.kcalPerKgDmb != null ? Math.round(combinedNutrition.kcalPerKgDmb).toLocaleString() : '—'}</td><td>—</td></tr>
      </table>
      <div class="meta" style="margin-top:4px;">AAFCO thresholds shown are for adult ${speciesLabel}. ✓ = meets or exceeds. ✗ = below threshold.</div>
    </div>

    ${supplementNutrients.length > 0 ? `
    <h2>Supplemental Nutrients</h2>
    <div class="bordered-section">
      ${supplementNutrients.map(s => `
        <div style="font-size:9px; margin:2px 0;">
          <strong>${esc(s.name)}:</strong> ${esc(s.value)}${s.unit ? esc(s.unit) : ''} (from: ${esc(s.sources.join(', '))})
        </div>
      `).join('')}
      <div class="meta" style="margin-top:6px;">Values are from manufacturer-reported GA. Actual intake depends on serving size and bioavailability.</div>
    </div>` : ''}

    <h2>Flags & Observations</h2>
    <div class="bordered-section">
      ${flags.map(f => `
        <div class="flag-row">
          <span class="flag-icon">${f.icon}</span>
          <span class="flag-label">${f.label}</span>
          <span class="flag-msg">${esc(f.message)}</span>
        </div>
      `).join('')}
    </div>

    <h2>Weight Tracking</h2>
    <div class="bordered-section" style="font-size:9px;">
      <div style="margin:2px 0;"><strong>Current:</strong> ${weightTracking.currentLbs > 0 ? weightTracking.currentLbs + ' lbs' : 'Not recorded'}${weightTracking.bcsScore != null ? `, BCS: ${weightTracking.bcsScore}/9 (${weightTracking.bcsScore <= 3 ? 'underweight' : weightTracking.bcsScore <= 5 ? 'ideal' : weightTracking.bcsScore <= 7 ? 'overweight' : 'obese'})` : ''}</div>
      <div style="margin:2px 0;"><strong>Goal:</strong> ${esc(weightTracking.goalLabel)}${data.adjustedDER > 0 ? ` (~${data.adjustedDER.toLocaleString()} kcal/day target)` : ''}</div>
      ${weightTracking.estimatedDriftLbs != null ? `<div style="margin:2px 0;"><strong>Estimated drift:</strong> ${weightTracking.estimatedDriftLbs > 0 ? '+' : ''}${weightTracking.estimatedDriftLbs} lbs (based on tracked feeding data)</div>` : ''}
      <div style="margin:2px 0;"><strong>Last weighed:</strong> ${weightTracking.lastWeighed ? formatDate(weightTracking.lastWeighed) : 'Unknown'}</div>
    </div>

    ${renderFooter(2, true)}
  </div>`;
}

function renderUnifiedNutrientRow(
  name: string,
  asFed: number | null,
  dmb: number | null,
  aafco: { label: string; passes: boolean; dmbValue: number | null } | undefined,
): string {
  const asFedStr = asFed != null ? asFed.toFixed(1) + '%' : '—';
  const dmbStr = dmb != null ? dmb.toFixed(1) + '%' : '—';
  // Don't show pass/fail when there's no DMB data to check against
  const aafcoStr = aafco
    ? (aafco.dmbValue != null
      ? `${aafco.label} <span class="${aafco.passes ? 'check' : 'fail'}">${aafco.passes ? '✓' : '✗'}</span>`
      : '—')
    : '—';
  return `<tr><td><strong>${name}</strong></td><td>${asFedStr}</td><td>${dmbStr}</td><td>${aafcoStr}</td></tr>`;
}

// ─── Page 3: Per-Product + Health + Conditions + Notes ───

function renderPage3(data: VetReportData): string {
  const { dietItems, healthRecords, conditionNotes, upcomingAppointments } = data;

  // Build inline macro string: "Protein: 26% | Fat: 15% | Fiber: 5% | M: 10%"
  const macroLine = (d: VetReportDietItem): string => {
    const parts: string[] = [];
    if (d.gaProtein != null) parts.push(`Protein: ${d.gaProtein}%`);
    if (d.gaFat != null) parts.push(`Fat: ${d.gaFat}%`);
    if (d.gaFiber != null) parts.push(`Fiber: ${d.gaFiber}%`);
    if (d.gaMoisture != null) parts.push(`M: ${d.gaMoisture}%`);
    return parts.length > 0 ? parts.join(' | ') : '';
  };

  return `<div class="page">
    <h2>Per-Product Detail</h2>
    ${dietItems.map((d, idx) => `
      <div class="bordered-section" style="margin-bottom:8px;">
        <div style="font-size:10px; font-weight:700; margin-bottom:4px;">
          ${idx + 1}. ${esc(d.productName)}${d.isRecalled ? ' <span style="color:#C62828;">⚠ RECALLED</span>' : ''}
        </div>
        <div style="font-size:9px;">
          <strong>Category:</strong> ${esc(d.category === 'treat' ? 'Treat' : d.isSupplemental ? 'Supplemental (Topper)' : `Daily Food (${d.form})`)}
        </div>
        ${d.aafcoStatement ? `<div style="font-size:9px;"><strong>AAFCO:</strong> ${esc(d.aafcoStatement)}</div>` : ''}
        ${macroLine(d) ? `<div style="font-size:9px;"><strong>${macroLine(d)}</strong></div>` : ''}
        ${d.gaKcalPerKg != null ? `<div style="font-size:9px;"><strong>kcal/kg:</strong> ${d.gaKcalPerKg.toLocaleString()}</div>` : ''}
        ${d.allergenFlags.length > 0 ? `<div style="color:#C62828; font-size:9px; margin-top:2px;">⚠ Contains ${d.allergenFlags.join(', ')} (allergen for ${esc(data.pet.name)})</div>` : ''}
        ${d.ingredients.length > 0 ? `<div class="meta" style="margin-top:3px;"><strong>Ingredients (first 10):</strong> ${d.ingredients.map(i => esc(i)).join(', ')}</div>` : ''}
      </div>
    `).join('')}

    ${healthRecords.vaccinations.length > 0 || healthRecords.dewormings.length > 0 ? `
    <h2>Health Records</h2>
    <div class="section">
      ${healthRecords.vaccinations.length > 0 ? `
        <h3>Vaccinations</h3>
        <table>
          <tr><th>Treatment</th><th>Date</th><th>Next Due</th><th>Vet</th></tr>
          ${healthRecords.vaccinations.slice(0, 10).map(r => `
            <tr><td>${esc(r.treatment_name)}</td><td>${formatDate(r.administered_at)}</td><td>${r.next_due_at ? formatDate(r.next_due_at) : '—'}</td><td>${esc(r.vet_name ?? '—')}</td></tr>
          `).join('')}
        </table>
      ` : ''}
      ${healthRecords.dewormings.length > 0 ? `
        <h3>Dewormings</h3>
        <table>
          <tr><th>Treatment</th><th>Date</th><th>Next Due</th><th>Vet</th></tr>
          ${healthRecords.dewormings.slice(0, 5).map(r => `
            <tr><td>${esc(r.treatment_name)}</td><td>${formatDate(r.administered_at)}</td><td>${r.next_due_at ? formatDate(r.next_due_at) : '—'}</td><td>${esc(r.vet_name ?? '—')}</td></tr>
          `).join('')}
        </table>
      ` : ''}
    </div>` : ''}

    ${upcomingAppointments.length > 0 ? `
    <div class="section">
      <h3>Upcoming Appointments</h3>
      <table>
        <tr><th>Type</th><th>Date</th><th>Location</th></tr>
        ${upcomingAppointments.slice(0, 5).map(a => `
          <tr><td>${esc(a.custom_label ?? a.type)}</td><td>${formatDate(a.scheduled_at)}</td><td>${esc(a.location ?? '—')}</td></tr>
        `).join('')}
      </table>
    </div>` : ''}

    ${conditionNotes.length > 0 ? `
    <h2>Condition Management Notes</h2>
    ${conditionNotes.map(cn => `
      <div class="section">
        <h3>${esc(cn.conditionLabel)}</h3>
        <ul style="margin-left:16px; font-size:9px;">
          ${cn.observations.map(o => `<li>${esc(o)}</li>`).join('')}
        </ul>
      </div>
    `).join('')}` : ''}

    <h2>Vet Notes</h2>
    <div class="section">
      ${Array.from({ length: 5 }, () => '<div class="ruled-line"></div>').join('')}
    </div>

    ${renderFooter(3, true)}
  </div>`;
}

// ─── Page 4: Owner Dietary Reference (conditional) ──────

function renderPage4(data: VetReportData): string {
  const { ownerDietaryCards, conditionConflicts, pet } = data;
  
  // Build a set of conflict pairs for inline rendering
  const conflictMap = new Map<string, ConflictNote>();
  for (const c of conditionConflicts) {
    conflictMap.set(`${c.conditions[0]}|${c.conditions[1]}`, c);
    conflictMap.set(`${c.conditions[1]}|${c.conditions[0]}`, c);
  }

  // Track which conflicts have been rendered
  const renderedConflicts = new Set<string>();

  const cardHTML = ownerDietaryCards.map((card, idx) => {
    // Check for conflict between this card and the previous one
    let conflictHTML = '';
    if (idx > 0) {
      const prevKey = ownerDietaryCards[idx - 1].conditionKey;
      const pairKey = `${prevKey}|${card.conditionKey}`;
      const conflict = conflictMap.get(pairKey);
      if (conflict && !renderedConflicts.has(pairKey)) {
        renderedConflicts.add(pairKey);
        renderedConflicts.add(`${card.conditionKey}|${prevKey}`);
        conflictHTML = `<div class="conflict-box"><span class="conflict-icon">⚠</span> <strong>Conflicting Guidance:</strong> ${esc(conflict.note)}</div>`;
      }
    }

    return `${conflictHTML}
      <div class="card">
        <div class="card-title">${esc(card.conditionLabel)}</div>
        <div class="card-field"><strong>Goal:</strong> ${esc(card.goal)}</div>
        <div class="card-field"><strong>Look for:</strong> ${esc(card.lookFor)}</div>
        <div class="card-field"><strong>Avoid:</strong> ${esc(card.avoid)}</div>
        ${card.caloricNote ? `<div class="card-field"><strong>Caloric note:</strong> ${esc(card.caloricNote)}</div>` : ''}
        ${card.note ? `<div class="card-field" style="font-style:italic;">${esc(card.note)}</div>` : ''}
        ${card.speciesCallout ? `<div class="card-field" style="color:#C62828; font-weight:600;">${esc(card.speciesCallout)}</div>` : ''}
        <div class="meta" style="margin-top:4px;">${esc(card.citation)}</div>
      </div>`;
  }).join('\n');

  // Render any remaining conflicts not between adjacent cards
  const remainingConflicts = conditionConflicts
    .filter(c => !renderedConflicts.has(`${c.conditions[0]}|${c.conditions[1]}`))
    .map(c => `<div class="conflict-box"><span class="conflict-icon">⚠</span> <strong>${esc(formatConditionLabel(c.conditions[0]))} + ${esc(formatConditionLabel(c.conditions[1]))}:</strong> ${esc(c.note)}</div>`)
    .join('\n');

  return `<div class="page">
    <h2>Owner Dietary Reference</h2>
    <div class="meta" style="margin-bottom:8px;">
      Condition-specific dietary guidance for ${esc(pet.name)}. These are general educational guidelines — always follow your veterinarian's specific recommendations.
    </div>
    ${cardHTML}
    ${remainingConflicts}
    ${renderFooter(4, true)}
  </div>`;
}

// ─── Shared Helpers ─────────────────────────────────────

function renderFooter(pageNum: number, includeDisclaimer: boolean = false): string {
  const disclaimer = includeDisclaimer
    ? `<div style="margin-bottom:4px;">This report is generated by Kiba (kibascan.com). It presents owner-reported dietary data for veterinary review. It does not constitute veterinary advice. All dietary decisions should be made in consultation with a licensed veterinarian.</div>`
    : '';
  return `<div class="footer">${disclaimer}Page ${pageNum}</div>`;
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatAge(dob: string): string {
  const birth = new Date(dob);
  const now = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}y ${rem}m` : `${years}y`;
}

const CONDITION_LABEL_MAP: Record<string, string> = {
  ckd: 'Kidney Disease', cardiac: 'Heart Disease', pancreatitis: 'Pancreatitis',
  diabetes: 'Diabetes', urinary: 'Urinary Issues', obesity: 'Overweight',
  underweight: 'Underweight', gi_sensitive: 'Sensitive Stomach', skin: 'Skin & Coat',
  hypothyroid: 'Hypothyroidism', hyperthyroid: 'Hyperthyroidism', joint: 'Joint Issues',
  allergy: 'Food Allergies', liver: 'Liver Disease', seizures: 'Seizures',
};

function formatConditionLabel(tag: string): string {
  return CONDITION_LABEL_MAP[tag] ?? tag;
}
