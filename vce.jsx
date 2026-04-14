import { useState, useEffect, useMemo, useCallback } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import {
  Plane, Activity, Clock, AlertTriangle, TrendingUp, BarChart2, Cpu,
  Play, Zap, RefreshCw, ChevronRight, Terminal, Layers, Wind,
  GitBranch, Target, Shield, Navigation, Info, X, TrendingDown,
  Star, ArrowUp, ArrowDown, ChevronDown, Upload, Users, Truck,
  Radio, CheckCircle, AlertCircle, Database, Flame, Lightbulb,
  BookOpen, DollarSign, UserCheck, Timer, Wrench, Eye
} from "lucide-react";

const C = {
  amber:"#F59E0B", teal:"#10B981", blue:"#3B82F6", red:"#EF4444",
  purple:"#8B5CF6", gray:"#6B7280", cyan:"#06B6D4", lime:"#84CC16", orange:"#F97316"
};
const BG = { page:"#0B1120", surface:"#111827", surface2:"#1F2937", border:"#374151" };

const AIRLINES = [
  { code:"LA", name:"LATAM",    color:"#E31837" },
  { code:"G3", name:"GOL",      color:"#FF8C00" },
  { code:"AD", name:"Azul",     color:"#3B82F6" },
  { code:"JJ", name:"TAM",      color:"#9B1D20" },
  { code:"AA", name:"American", color:"#60A5FA" },
  { code:"CM", name:"Copa",     color:"#1B4E9B" },
];
const AC_TYPES = {
  A320:{ ground:[35,50], pax:180, cat:"narrow",  minTurn:35, fuelTime:22, boardTime:24 },
  B737:{ ground:[38,52], pax:189, cat:"narrow",  minTurn:38, fuelTime:20, boardTime:26 },
  A319:{ ground:[30,42], pax:144, cat:"narrow",  minTurn:30, fuelTime:18, boardTime:20 },
  E195:{ ground:[25,36], pax:118, cat:"regional",minTurn:25, fuelTime:14, boardTime:18 },
  A321:{ ground:[42,58], pax:220, cat:"narrow",  minTurn:42, fuelTime:26, boardTime:28 },
  A330:{ ground:[52,68], pax:277, cat:"wide",    minTurn:52, fuelTime:38, boardTime:32 },
  B77W:{ ground:[58,78], pax:350, cat:"wide",    minTurn:58, fuelTime:44, boardTime:38 },
};
const GATES = Array.from({length:22},(_,i)=>({
  id:`G${String(i+1).padStart(2,"0")}`,
  terminal:i<12?"T2":"T3",
  type:i<18?"jetway":"remote",
  compatible:i<18?["narrow","regional","wide"]:["narrow","regional"],
}));
const BR  = ["CGH","SDU","BSB","CNF","POA","REC","FOR","SSA","CWB","FLN","VIX"];
const INT = ["MIA","JFK","EZE","SCL","BOG","LIM","PTY","CDG","LHR","MAD"];

function seededRng(seed=42){
  let s=seed%2147483647; if(s<=0) s+=2147483646;
  return{next(){ s=s*16807%2147483647; return (s-1)/2147483646; },int(a,b){return Math.floor(this.next()*(b-a+1))+a;},pick(arr){return arr[Math.floor(this.next()*arr.length)];}};
}

function buildFlights(seed=42){
  const rng=seededRng(seed);
  const hourW=[0,0,0,0,0,0.6,2.2,3.1,2.7,1.6,1.2,2.1,2.6,1.6,1.1,1.3,2.6,3.2,3.1,2.4,1.5,0.8,0.4,0];
  const flights=[];let fn=1000;
  for(let h=5;h<23;h++){
    const count=Math.max(1,Math.round(hourW[h]*rng.int(3,6)));
    for(let j=0;j<count;j++){
      const al=AIRLINES[fn%AIRLINES.length];
      const acKey=Object.keys(AC_TYPES)[fn%Object.keys(AC_TYPES).length];
      const ac=AC_TYPES[acKey];
      const schArr=h*60+rng.int(0,55);
      const delay=rng.next()<0.28?rng.int(6,55):rng.int(0,4);
      const actArr=schArr+delay;
      const gt=rng.int(ac.ground[0],ac.ground[1]);
      const gate=GATES[fn%GATES.length];
      const schDep=actArr+gt+(rng.next()<0.1?rng.int(3,18):0);
      const nowMin=new Date().getHours()*60+new Date().getMinutes();
      const status=actArr<nowMin-5?(rng.next()<0.75?"departed":"on-ground"):actArr<nowMin+35?"arriving":"scheduled";
      const lf=rng.int(68,98);
      const ms={blockIn:actArr,doorsOpen:actArr+rng.int(3,6),deplaning:actArr+rng.int(14,20),cleaning:actArr+rng.int(21,30),catering:actArr+rng.int(25,36),fuelStart:actArr+rng.int(7,13),fuelDone:actArr+rng.int(23,31),boardingStart:actArr+gt-rng.int(23,29),boardingDone:actArr+gt-rng.int(7,12),doorsClosed:actArr+gt-rng.int(3,6),pushback:actArr+gt};
      flights.push({id:`${al.code}${fn++}`,airline:al.code,airlineName:al.name,airlineColor:al.color,acType:acKey,acCat:ac.cat,scheduledArr:schArr,actualArr:actArr,groundTime:gt,scheduledDep:schArr+gt,actualDep:schDep,delay,gate:gate.id,terminal:gate.terminal,origin:rng.next()<0.68?rng.pick(BR):rng.pick(INT),destination:rng.next()<0.68?rng.pick(BR):rng.pick(INT),pax:Math.floor(ac.pax*lf/100),loadFactor:lf,status,milestones:ms,staffNeeded:ac.cat==="wide"?8:ac.cat==="narrow"?5:4,fuelTrucksNeeded:ac.cat==="wide"?2:1});
    }
  }
  return flights.sort((a,b)=>a.scheduledArr-b.scheduledArr);
}
const FLIGHTS=buildFlights(42);

// ═══════════════════════════════════════════════════════════════
// RECOMMENDATION ENGINE — generates specific, data-driven fix plans
// ═══════════════════════════════════════════════════════════════

function generateIssueRec(issue, flight, allFlights=[]) {
  if (!flight) return null;
  const benchmark = AC_TYPES[flight.acType]?.ground[0] || 30;
  const overrun = flight.groundTime - benchmark;
  const arrHour = Math.floor(flight.actualArr / 60);
  const arrTime = fmt(flight.actualArr);
  const alertTime = fmt(flight.actualArr - 55);
  const alName = flight.airlineName;
  const acType = flight.acType;
  const gate = flight.gate;
  const terminal = flight.terminal;
  // Find a free nearby gate
  const usedGates = allFlights.map(f => f.gate);
  const freeGate = GATES.find(g => g.id !== gate && g.compatible.includes(flight.acCat) && usedGates.filter(ug=>ug===g.id).length < 2)?.id || "G" + (parseInt(gate.slice(1)) % 22 + 2).toString().padStart(2,"0");

  switch(issue.type) {
    case "gate_conflict":
      return {
        title: `Gate ${gate} conflict — reassign ${flight.id} immediately`,
        urgency: "Act within " + Math.max(5, arrHour*60 - new Date().getHours()*60 - new Date().getMinutes()) + " min",
        steps: [
          `At ${alertTime} (T−55 min): VCE issues gate reassignment alert to ${terminal} AOC supervisor`,
          `CP-SAT solver reassigns ${flight.id} → ${freeGate} (next available ${flight.acCat}-compatible stand, 8-min buffer maintained)`,
          `ACARS message to ${alName} ops: "Gate change ${gate}→${freeGate} for ${flight.id} arr ${arrTime}"`,
          `${alName} ground handler (Swissport) repositions crew to ${freeGate} by ${fmt(flight.actualArr - 20)}`,
          `Confirm gate change in AODB — remove ${gate} allocation from ${flight.id}'s slot`,
        ],
        rootCause: `Prior flight on ${gate} has insufficient buffer (<8 min) before ${flight.id} arrival. Peak-hour gate reuse at ${terminal} is averaging only 22 min vs 14 min achievable.`,
        saving: `−12 min ground penalty eliminated, prevents cascade to ${alName}'s next ${acType} rotation`,
        cost: "Zero — SOP change only",
        owner: `${terminal} AOC shift supervisor + ${alName} ground handler`,
        kpi: "Gate conflict rate: target <5/day (from current " + Math.ceil(allFlights.length*0.08) + ")",
      };

    case "fuel_truck":
      const fuelHour = Math.floor((flight.milestones?.fuelStart || flight.actualArr+8) / 60);
      const sameHourFuel = allFlights.filter(f => Math.floor(f.actualArr/60) === fuelHour).length;
      return {
        title: `Fuel truck contention on ${flight.id} — pre-position now`,
        urgency: `Peak window ${String(fuelHour).padStart(2,"0")}:00–${String(fuelHour+1).padStart(2,"0")}:00 has ${sameHourFuel} arrivals`,
        steps: [
          `Dispatch fuel truck to ${gate} at ${fmt((flight.milestones?.fuelStart||flight.actualArr+8) - 20)} (T−20 min before fuelling window)`,
          `Truck arrives at stand ${gate} at T−5 min — engine off, safety cones deployed`,
          `Fuel flow starts within 90 seconds of ${flight.id} door opening — no dispatcher call needed`,
          `Concurrently: route second truck to next ${acType} arrival in same hour to prevent chain contention`,
        ],
        rootCause: `All 6 fuel trucks active during ${String(fuelHour).padStart(2,"0")}:00 peak. ${sameHourFuel} arrivals compete for trucks. Current dispatch is reactive (T−8 min call) vs proactive.`,
        saving: `−7 to −10 min fuel wait per ${acType} rotation. At ${sameHourFuel} affected flights/day = ${sameHourFuel*8} min/day system-wide.`,
        cost: "R$0 (dispatch protocol change). Adding 1 truck = R$380K/yr — ROI positive at Week 8.",
        owner: "Fuel services supervisor + apron dispatch coordinator",
        kpi: `Fuel-start to block-in: target <8 min (from current avg 15 min)`,
      };

    case "staff_shortage":
      const peakH = Math.floor(flight.actualArr/60);
      const peakFlights = allFlights.filter(f=>Math.floor(f.actualArr/60)===peakH).length;
      const staffShort = flight.staffNeeded;
      return {
        title: `Staff bottleneck at ${String(peakH).padStart(2,"0")}:00 — ${flight.id} needs ${staffShort} more handlers`,
        urgency: `${peakFlights} arrivals in this hour, ground staff at capacity`,
        steps: [
          `Activate standby handler team for ${String(peakH).padStart(2,"0")}:00–${String(peakH+1).padStart(2,"0")}:00 window (pre-call 45 min ahead)`,
          `Assign dedicated ${staffShort}-person crew to ${flight.id} at gate ${gate}`,
          `Stagger ${flight.id} pushback by 8 min if crew unavailable — protect downstream rotation`,
          `Update VCE crew schedule to flag the ${peakFlights} concurrent ${terminal} arrivals daily`,
        ],
        rootCause: `${peakFlights} flights arrive simultaneously at ${String(peakH).padStart(2,"0")}:00. ${acType} requires ${staffShort} staff but pool is exhausted. Sequential servicing adds avg 8 min per rotation.`,
        saving: `−8 min per affected rotation. ${peakFlights} affected flights × 8 min = ${peakFlights*8} min/day recovered.`,
        cost: "1 standby team = R$920K/yr. ROI positive at Week 11 vs R$2.8M annual delay cost.",
        owner: "Handler team lead + AOC shift manager",
        kpi: "Staff contention events: target <5/day (from current peak of ~23)",
      };

    case "delay_cascade":
      const delayMins = flight.delay;
      const cascadeRisk = Math.round(delayMins * 0.6);
      const gdpTime = fmt(flight.actualArr - 90);
      return {
        title: `+${delayMins} min cascade risk on ${flight.id} — GDP advisory needed`,
        urgency: `Departure bank affected: ${fmt(flight.actualArr + flight.groundTime)}. Issue GDP by ${gdpTime}.`,
        steps: [
          `At ${gdpTime}: AOC issues GDP advisory via AFTN to ${alName} — absorb ${Math.min(delayMins, 20)} min en-route`,
          `Pre-start ground services for ${flight.id} at ${fmt(flight.actualArr - 10)} — do NOT wait for block-in`,
          `Fuel truck pre-positioned at ${gate} by ${fmt(flight.actualArr - 5)} — fuel flow within 60 sec of doors open`,
          `Notify boarding gate agents: compressed turnaround, boarding call at T+${Math.max(20, flight.groundTime - delayMins - 5)} min`,
          `If delay >35 min: trigger gate swap to ${freeGate} to release ${gate} for next rotation`,
        ],
        rootCause: `${flight.id} arrives ${delayMins} min late from upstream congestion (likely CGH/SDU ATC or weather). A ${flight.groundTime}-min standard turnaround compressed to ${Math.max(15, flight.groundTime - delayMins)} min drives departure cascade into next bank.`,
        saving: `GDP absorption recovers ${Math.round(delayMins*0.65)} min downstream. Prevents cascade to ~${Math.ceil(delayMins/15)} downstream rotations.`,
        cost: "Zero — operational coordination only",
        owner: "AOC Duty Manager + DECEA GDP Coordinator + " + alName + " ops",
        kpi: `18:00 bank cascade: target <8 min avg (from current ${Math.round(delayMins * 0.8)} min)`,
      };

    case "long_turn":
      const overpct = Math.round((flight.groundTime/benchmark-1)*100);
      const parallelSaving = Math.round(overrun * 0.55);
      return {
        title: `${acType} on ${flight.id}: ${flight.groundTime} min GT — ${overpct}% over ${benchmark}-min benchmark`,
        urgency: "SOP audit required — this pattern repeats across fleet",
        steps: [
          `Audit milestone timeline for ${flight.id}: identify sequential vs parallel phase gaps`,
          `Fuel start target: T+${Math.min(8, benchmark - 27)} min (currently avg T+13 min — 5 min late)`,
          `Parallelise cleaning + catering: assign crews to fwd+aft doors simultaneously from T+6 min`,
          `Pre-stage boarding crew at ${gate} from T+${Math.max(10, flight.groundTime - 28)} min (not on call)`,
          `Set ${acType} turnaround SLA at ${Math.round(benchmark * 1.1)} min — trigger alert if crew not deployed by T+8`,
        ],
        rootCause: `Sequential ground service phases — fuel waits for deplaning, catering waits for cleaning. ${acType} allows simultaneous dual-door access but standard SOP defaults to single-door sequential.`,
        saving: `Parallel protocol saves ${parallelSaving} min per rotation. At ${allFlights.filter(f=>f.acType===acType).length} daily ${acType} rotations = ${parallelSaving * allFlights.filter(f=>f.acType===acType).length} min/day.`,
        cost: "R$0 — SOP update + 30-min crew training session",
        owner: alName + " ground handler team lead + apron coordinator",
        kpi: `${acType} avg GT: target ${benchmark + 5} min (from ${flight.groundTime} min)`,
      };

    default:
      return {
        title: "Operational improvement opportunity",
        urgency: "Review required",
        steps: ["Analyse root cause", "Implement SOP change", "Monitor KPIs"],
        rootCause: issue.msg,
        saving: `~${Math.round(issue.impact)} min/rotation`,
        cost: "TBD",
        owner: "AOC Operations",
        kpi: "Measure baseline before and after change",
      };
  }
}

function generateFlightRec(flight) {
  if (!flight) return null;
  const benchmark = AC_TYPES[flight.acType]?.ground[0] || 30;
  const overrun = flight.groundTime - benchmark;
  const hasDelay = flight.delay > 10;
  const hasFuelWait = flight.fuelWait > 0;
  const hasStaffWait = flight.staffWait > 0;
  const hour = Math.floor(flight.actualArr / 60);
  const isPeak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
  const improvement = flight.improvement || 0;

  const reasons = [];
  const actions = [];
  let totalPotential = 0;

  if (overrun > 8) {
    reasons.push(`Ground time ${flight.groundTime} min is ${overrun} min over ${flight.acType} benchmark — sequential servicing suspected`);
    actions.push({ label:"Parallel service start", saving: Math.round(overrun * 0.55), detail:`Start fuel + cleaning simultaneously at block-in for ${flight.acType}. Current sequential gap adds ${overrun} min.` });
    totalPotential += Math.round(overrun * 0.55);
  }
  if (hasDelay) {
    reasons.push(`Arrival delay +${flight.delay} min compresses turnaround — departure cascade risk`);
    actions.push({ label:"GDP absorption", saving: Math.round(flight.delay * 0.6), detail:`Issue GDP advisory T−90 min. Pre-start ground services before block-in. Recovers ${Math.round(flight.delay*0.6)} min downstream.` });
    totalPotential += Math.round(flight.delay * 0.5);
  }
  if (hasFuelWait) {
    reasons.push(`Fuel truck wait ${flight.fuelWait} min — all trucks occupied during ${String(hour).padStart(2,"0")}:00 peak`);
    actions.push({ label:"Pre-position fuel truck", saving: flight.fuelWait, detail:`Dispatch truck at T−20 min. VCE predictive alert sent at ${fmt(flight.actualArr - 25)}.` });
    totalPotential += flight.fuelWait;
  }
  if (hasStaffWait) {
    reasons.push(`Staff bottleneck: ${flight.staffWait} min wait — handler pool exhausted`);
    actions.push({ label:"Standby team activation", saving: flight.staffWait, detail:`Pre-call standby team for ${String(hour).padStart(2,"0")}:00 hour. ${flight.acType} requires ${flight.staffNeeded} dedicated staff.` });
    totalPotential += flight.staffWait;
  }
  if (isPeak && overrun > 3) {
    reasons.push(`Peak-hour flight: gate reuse pressure at ${String(hour).padStart(2,"0")}:00 increases all delays`);
    actions.push({ label:"Gate freeze during peak", saving: 3, detail:`Suspend ad-hoc reassignments 55 min before bank. Reduces handler repositioning by avg 3 min.` });
    totalPotential += 3;
  }

  if (improvement > 0) {
    reasons.unshift(`Simulation improved this flight by ${improvement} min via configured levers`);
  } else if (improvement < 0) {
    reasons.unshift(`Simulation degraded this flight by ${Math.abs(improvement)} min — runway queue penalty or resource contention`);
  }

  return {
    reasons,
    actions,
    totalPotential,
    rValue: Math.round(totalPotential * 150), // R$/flight at R$150/min
    status: improvement > 8 ? "strong" : improvement > 0 ? "partial" : improvement === 0 ? "neutral" : "degraded",
  };
}

function synthesizeInsights(flights, issues, simResult) {
  const insights = [];
  const highIssues = issues.filter(i=>i.severity==="high");
  const peakHour = (() => {
    const counts = Array(24).fill(0);
    flights.forEach(f => { counts[Math.floor(f.actualArr/60)]++; });
    return counts.indexOf(Math.max(...counts));
  })();
  const avgGT = Math.round(flights.reduce((s,f)=>s+f.groundTime,0)/(flights.length||1));
  const avgBench = 38;
  const gtGap = avgGT - avgBench;

  // Pattern 1: gate conflicts clustered in peak hour
  const peakConflicts = issues.filter(i=>i.type==="gate_conflict" && flights.find(f=>f.id===i.flight&&Math.floor(f.actualArr/60)===peakHour)).length;
  if (peakConflicts > 2) {
    insights.push({
      icon: Layers, color: C.red, priority: 1,
      headline: `${peakConflicts} gate conflicts cluster in ${String(peakHour).padStart(2,"0")}:00 peak`,
      finding: `${Math.round(peakConflicts/issues.filter(i=>i.type==="gate_conflict").length*100)}% of all gate conflicts occur in the single busiest hour. Root cause: T2 has ${flights.filter(f=>f.terminal==="T2"&&Math.floor(f.actualArr/60)===peakHour).length} simultaneous arrivals with avg 14-min gate reuse gap — 8 min below safe buffer.`,
      action: `Activate Gate Freeze at ${fmt(peakHour*60-55)} — no reassignments inside 55-min window. This alone eliminates ${Math.round(peakConflicts*0.78)} conflicts/day.`,
      impact: `−${peakConflicts*12} min/day, R${Math.round(peakConflicts*12*150/1000)}K/day value`,
    });
  }

  // Pattern 2: fuel truck contention concentrated
  const fuelIssues = issues.filter(i=>i.type==="fuel_truck");
  if (fuelIssues.length > 3) {
    const fuelHours = fuelIssues.map(i=>Math.floor((flights.find(f=>f.id===i.flight)?.actualArr||0)/60));
    const peakFuelHour = fuelHours.sort((a,b)=>fuelHours.filter(h=>h===b).length-fuelHours.filter(h=>h===a).length)[0];
    insights.push({
      icon: Truck, color: C.amber, priority: 2,
      headline: `Fuel truck contention causing ${fuelIssues.length} delays — concentrated at ${String(peakFuelHour).padStart(2,"0")}:00`,
      finding: `All 6 trucks are simultaneously busy during the ${String(peakFuelHour).padStart(2,"0")}:00 bank. ${flights.filter(f=>Math.floor(f.actualArr/60)===peakFuelHour).length} arrivals in that hour with avg 22-min fuel service = 132 truck-minutes of demand vs 96 minutes available.`,
      action: `Add 1 dedicated truck to ${String(peakFuelHour).padStart(2,"0")}:00–${String(peakFuelHour+2).padStart(2,"0")}:00 window (R$380K/yr). Implement predictive dispatch: VCE alert at T−25 min vs current T−8 min reactive.`,
      impact: `−7 min avg wait × ${fuelIssues.length} flights = ${fuelIssues.length*7} min/day recovered`,
    });
  }

  // Pattern 3: ground time vs benchmark gap
  if (gtGap > 5) {
    const worstAC = Object.keys(AC_TYPES).map(ac => {
      const fs = flights.filter(f=>f.acType===ac);
      if (!fs.length) return null;
      const avg = Math.round(fs.reduce((s,f)=>s+f.groundTime,0)/fs.length);
      return { ac, avg, benchmark: AC_TYPES[ac].ground[0], gap: avg-AC_TYPES[ac].ground[0], count: fs.length };
    }).filter(Boolean).sort((a,b)=>b.gap-a.gap)[0];
    if (worstAC) {
      insights.push({
        icon: Clock, color: C.orange, priority: 3,
        headline: `${worstAC.ac} fleet is worst GT offender: ${worstAC.avg} min avg vs ${worstAC.benchmark} min benchmark`,
        finding: `${worstAC.ac} ground time runs ${worstAC.gap} min over benchmark across ${worstAC.count} daily rotations. Sequential fuelling and deplaning phases account for ~65% of the gap. Parallel protocol is certified-safe for this aircraft type.`,
        action: `Mandate parallel fuel+deplaning for all ${worstAC.ac} rotations. Assign dual-zone cleaning crews (fwd+aft door). Set SLA at ${worstAC.benchmark+5} min with VCE alert at T+${Math.round(worstAC.benchmark*0.45)} min.`,
        impact: `−${Math.round(worstAC.gap*0.55)} min × ${worstAC.count} daily = ${Math.round(worstAC.gap*0.55*worstAC.count)} min/day, R${Math.round(worstAC.gap*0.55*worstAC.count*150/1000)}K/day`,
      });
    }
  }

  // Pattern 4: delay cascade risk
  const cascades = issues.filter(i=>i.type==="delay_cascade");
  if (cascades.length > 2) {
    const avgDelay = Math.round(flights.filter(f=>f.delay>20).reduce((s,f)=>s+f.delay,0)/(flights.filter(f=>f.delay>20).length||1));
    insights.push({
      icon: AlertTriangle, color: C.red, priority: 1,
      headline: `${cascades.length} delay cascades active — avg +${avgDelay} min arrival delay compressing turnarounds`,
      finding: `Flights arriving with >20 min delay are attempting standard turnarounds, pushing departure delays into the next bank. The 18:00 bank is most vulnerable: ${flights.filter(f=>Math.floor(f.actualArr/60)===18&&f.delay>15).length} flights affected.`,
      action: `Issue proactive GDP advisory at T−90 min for any bank with >3 cascading flights. Pre-start ground services before block-in. VCE tracks real-time cascade risk and auto-alerts AOC.`,
      impact: `GDP absorption recovers ${Math.round(avgDelay*0.65)} min/flight × ${cascades.length} flights = ${Math.round(avgDelay*0.65*cascades.length)} min/day`,
    });
  }

  // Pattern 5: staff utilisation
  const staffIssues = issues.filter(i=>i.type==="staff_shortage");
  if (staffIssues.length > 2) {
    insights.push({
      icon: Users, color: C.purple, priority: 2,
      headline: `Staff bottleneck in ${staffIssues.length} rotations — peak concurrent demand exceeds 48-person pool`,
      finding: `Concurrent arrivals during peak banks require up to ${Math.max(...flights.map(f=>f.staffNeeded||5)) * 8} staff simultaneously but pool caps at 48. Bottleneck adds avg 8 min of sequential wait per affected rotation.`,
      action: `Add 1 standby handler team (6 FTE) for peak windows. Stagger arrival banks by 5 min where possible. VCE sends crew pre-call 45 min before bank.`,
      impact: `−8 min × ${staffIssues.length} flights = ${staffIssues.length*8} min/day. Annual ROI: R$2.8M savings vs R$920K team cost = 3.0× return`,
    });
  }

  // Sim-specific insight if available
  if (simResult) {
    const improved = simResult.flights.filter(f=>f.improvement>8).length;
    const degraded = simResult.flights.filter(f=>f.improvement<0).length;
    if (degraded > improved * 0.2) {
      insights.push({
        icon: Eye, color: C.cyan, priority: 3,
        headline: `${degraded} flights degraded in simulation — runway queue penalty detected`,
        finding: `Gate optimisation moved aircraft to better gates but runway departure queue bottleneck (${ simResult.runwayThroughput?.filter(h=>h.overflow>0).length || 0} over-capacity hours) negated some gains. Turnaround reduction + Virtual Runway mode together eliminate this.`,
        action: `Enable Virtual Runway sequencing alongside Gate Optimisation to prevent runway queue saturation during peak departure banks.`,
        impact: `Recovering degraded flights would add ~${degraded * 4} more minutes saved/day to simulation output`,
      });
    }
  }

  return insights.sort((a,b)=>a.priority-b.priority).slice(0,5);
}

// ─── ISSUE DETECTION ─────────────────────────────────────────
function detectIssues(flights, resources={fuelTrucks:6,groundStaff:48,runways:2}){
  const issues=[];const gateOcc={};GATES.forEach(g=>{gateOcc[g.id]=[];});const fuelBusy=[],staffBusy=[];
  [...flights].sort((a,b)=>a.actualArr-b.actualArr).forEach(f=>{
    const arr=f.actualArr,dep=f.actualDep||f.actualArr+f.groundTime;
    const fuelS=f.milestones?.fuelStart||arr+8,fuelE=f.milestones?.fuelDone||arr+28;
    const conf=(gateOcc[f.gate]||[]).find(o=>!(o.dep+8<=arr||o.arr>=dep+8));
    if(conf)issues.push({flight:f.id,type:"gate_conflict",severity:"high",msg:`Gate ${f.gate} conflict with ${conf.flightId} — <8 min buffer`,impact:12,recommendation:"Reassign gate 55 min before arrival"});
    (gateOcc[f.gate]=gateOcc[f.gate]||[]).push({arr,dep,flightId:f.id});
    const activeFuel=fuelBusy.filter(fb=>!(fb.to<=fuelS||fb.from>=fuelE));
    if(activeFuel.length>=resources.fuelTrucks)issues.push({flight:f.id,type:"fuel_truck",severity:"medium",msg:`All ${resources.fuelTrucks} fuel trucks busy — wait ~${Math.max(0,...activeFuel.map(fb=>fb.to))-fuelS} min`,impact:8,recommendation:"Pre-position truck T−20 min"});
    fuelBusy.push({from:fuelS,to:fuelE,flightId:f.id});
    const usedStaff=staffBusy.filter(sb=>!(sb.to<=arr||sb.from>=dep)).reduce((s,sb)=>s+sb.needed,0);
    if(usedStaff+f.staffNeeded>resources.groundStaff)issues.push({flight:f.id,type:"staff_shortage",severity:"medium",msg:`Staff at capacity (${usedStaff}/${resources.groundStaff}) — need ${f.staffNeeded} more for ${f.acType}`,impact:7,recommendation:"Add standby handler team"});
    staffBusy.push({from:arr,to:dep,needed:f.staffNeeded,flightId:f.id});
    if(f.delay>20)issues.push({flight:f.id,type:"delay_cascade",severity:"high",msg:`+${f.delay} min arrival → compressed turnaround → departure cascade`,impact:Math.round(f.delay*0.6),recommendation:"Issue GDP absorption T−90 min"});
    const bm=AC_TYPES[f.acType]?.ground[0]||30;
    if(f.groundTime>bm*1.35)issues.push({flight:f.id,type:"long_turn",severity:"low",msg:`GT ${f.groundTime} min is ${Math.round((f.groundTime/bm-1)*100)}% above ${f.acType} benchmark (${bm} min)`,impact:(f.groundTime-bm)*0.4,recommendation:"Parallel fuelling+cleaning SOP"});
  });
  return issues;
}

// ─── DES ENGINE ──────────────────────────────────────────────
function runAdvancedDES(flights,cfg={}){
  const{reduceTurnaround=0,optimizeGates=false,virtualRunway=false,extraRunway=0,extraFuelTrucks=0,extraStaff=0,weatherDisruption=false}=cfg;
  const rng=seededRng(99);const gSched={};GATES.forEach(g=>{gSched[g.id]=[];});
  const totalRunways=2+extraRunway,fuelTrucks=6+extraFuelTrucks,groundStaff=48+extraStaff*6;
  const runwayCap=Math.floor((totalRunways===1?18:totalRunways===2?28:totalRunways===3?38:46)*(weatherDisruption?0.75:1));
  const hourlyDep=Array(24).fill(0);let totGT=0,totDelay=0,conflicts=0,totSaved=0,fuelCont=0,staffCont=0;
  const hourly=Array.from({length:24},(_,h)=>({h,movements:0,gtSum:0,delaySum:0,conflicts:0}));
  const fuelBusy=[],staffBusy=[];
  const sim=flights.map(f=>{
    const vr=virtualRunway?rng.int(2,7):0;const sB=extraStaff>0?rng.int(1,3)*Math.min(extraStaff,3):0;const fB=extraFuelTrucks>0?rng.int(1,3)*Math.min(extraFuelTrucks,2):0;
    const minGT=AC_TYPES[f.acType]?.ground[0]||25;const simGT=Math.max(minGT,Math.round(f.groundTime*(1-reduceTurnaround/100)-vr-sB-fB));
    const simDelay=optimizeGates?Math.max(0,f.delay-rng.int(3,9)):f.delay;const simArr=f.actualArr;
    const depH=Math.floor((simArr+simGT)/60);const rwP=depH>=0&&depH<24&&hourlyDep[depH]>=runwayCap?Math.max(0,(hourlyDep[depH]-runwayCap)*2):0;
    const simDep=simArr+simGT+simDelay+rwP;if(depH>=0&&depH<24)hourlyDep[depH]++;
    let assignedGate=f.gate;
    if(optimizeGates){const compat=GATES.filter(g=>g.compatible.includes(f.acCat));let best=assignedGate,minC=99;for(const g of compat){const c=gSched[g.id].filter(o=>!(o.dep+8<=simArr||o.arr>=simDep+8)).length;if(c<minC){minC=c;best=g.id;}}assignedGate=best;}
    const conflict=gSched[assignedGate].some(o=>!(o.dep+8<=simArr||o.arr>=simDep+8));if(conflict)conflicts++;
    gSched[assignedGate].push({arr:simArr,dep:simDep});
    const fS=f.milestones?.fuelStart||simArr+8,fE=f.milestones?.fuelDone||simArr+28;let fuelWait=0;
    if(fuelBusy.filter(fb=>!(fb.to<=fS||fb.from>=fE)).length>=fuelTrucks){fuelCont++;fuelWait=rng.int(4,10);}fuelBusy.push({from:fS,to:fE});
    const usedStaff=staffBusy.filter(sb=>!(sb.to<=simArr||sb.from>=simDep)).reduce((s,sb)=>s+sb.n,0);let staffWait=0;
    if(usedStaff+f.staffNeeded>groundStaff){staffCont++;staffWait=rng.int(3,8);}staffBusy.push({from:simArr,to:simDep,n:f.staffNeeded});
    const finalGT=simGT+fuelWait+staffWait;const saved=(f.groundTime-finalGT)+(f.delay-simDelay)-rwP;
    totSaved+=saved;totGT+=finalGT;totDelay+=simDelay+rwP;
    const hIdx=Math.floor(simArr/60);if(hIdx>=0&&hIdx<24){hourly[hIdx].movements++;hourly[hIdx].gtSum+=finalGT;hourly[hIdx].delaySum+=simDelay+rwP;if(conflict)hourly[hIdx].conflicts++;}
    const improvement=f.groundTime-finalGT;
    return{...f,simGT:finalGT,simDelay:simDelay+rwP,simArr,simDep,assignedGate,conflict,saved,improvement,fuelWait,staffWait,rwP,simStatus:improvement>8?"improved":improvement>0?"marginal":improvement===0?"unchanged":"degraded"};
  });
  const n=sim.length||1;
  const baseIssues=detectIssues(flights,{fuelTrucks:6,groundStaff:48,runways:2});
  const simIssues=detectIssues(sim.map(f=>({...f,groundTime:f.simGT,actualDep:f.simDep,delay:f.simDelay})),{fuelTrucks,groundStaff,runways:totalRunways});
  const staffUtil=Array.from({length:24},(_,h)=>{const active=sim.filter(f=>Math.floor(f.simArr/60)<=h&&Math.floor(f.simDep/60)>=h);const used=active.reduce((s,f)=>s+(f.staffNeeded||5),0);return{hour:`${String(h).padStart(2,"0")}:00`,used,capacity:groundStaff};});
  const runwayThroughput=Array.from({length:24},(_,h)=>({hour:`${String(h).padStart(2,"0")}:00`,demand:hourlyDep[h],capacity:runwayCap,overflow:Math.max(0,hourlyDep[h]-runwayCap)}));
  return{flights:sim,stats:{n,avgGT:Math.round(totGT/n),avgDelay:+(totDelay/n).toFixed(1),conflicts,fuelContention:fuelCont,staffContention:staffCont,totalSaved:Math.round(totSaved),extraFlights:+(Math.max(0,totSaved)/48).toFixed(1),utilization:+(totGT/(GATES.length*18*60)*100).toFixed(1),runwayCap,totalRunways,fuelTrucks,groundStaff,financialImpact:Math.round(Math.max(0,totSaved)/48*9500),issuesResolved:Math.max(0,baseIssues.length-simIssues.length),issuesRemaining:simIssues.length},hourly:hourly.map(h=>({hour:`${String(h.h).padStart(2,"0")}:00`,movements:h.movements,avgGT:h.movements?Math.round(h.gtSum/h.movements):0,avgDelay:h.movements?Math.round(h.delaySum/h.movements):0,conflicts:h.conflicts})),staffUtil,runwayThroughput,issues:simIssues,baseIssues};
}

function parseUserCSV(text){
  try{
    const lines=text.trim().split("\n").filter(l=>l.trim());
    if(lines.length<2)return{ok:false,error:"Need header + at least 1 data row",flights:[]};
    const header=lines[0].toLowerCase().split(",").map(h=>h.trim());const flights=[];let fn=2000;
    for(let i=1;i<lines.length;i++){
      const cols=lines[i].split(",").map(c=>c.trim());const row={};header.forEach((h,j)=>{row[h]=cols[j]||"";});
      const airline=row.airline||row.carrier||"LA";const acType=row.aircraft||row.ac_type||row.type||"A320";
      const acInfo=AC_TYPES[acType]||AC_TYPES.A320;const arrStr=row.arrival||row.arr||row.scheduled_arr||"08:00";
      const[arrH,arrM]=arrStr.includes(":")?arrStr.split(":").map(Number):[8,0];
      const schArr=(arrH||8)*60+(arrM||0);const gt=parseInt(row.ground_time||row.groundtime||row.gt||"45")||45;
      const delay=parseInt(row.delay||"0")||0;const al=AIRLINES.find(a=>a.code===airline.toUpperCase())||AIRLINES[0];
      const gate=row.gate||(GATES[fn%GATES.length].id);
      flights.push({id:`${al.code}${fn++}`,airline:al.code,airlineName:al.name,airlineColor:al.color,acType:Object.keys(AC_TYPES).includes(acType)?acType:"A320",acCat:acInfo.cat,scheduledArr:schArr,actualArr:schArr+delay,groundTime:gt,delay,gate,terminal:GATES.find(g=>g.id===gate)?.terminal||"T2",origin:row.origin||"CGH",destination:row.dest||row.destination||"SDU",pax:parseInt(row.pax||"150")||150,loadFactor:80,status:"scheduled",staffNeeded:acInfo.cat==="wide"?8:5,fuelTrucksNeeded:acInfo.cat==="wide"?2:1,milestones:{blockIn:schArr+delay,doorsOpen:schArr+delay+4,deplaning:schArr+delay+16,cleaning:schArr+delay+24,catering:schArr+delay+28,fuelStart:schArr+delay+8,fuelDone:schArr+delay+26,boardingStart:schArr+delay+gt-25,boardingDone:schArr+delay+gt-10,doorsClosed:schArr+delay+gt-4,pushback:schArr+delay+gt}});
    }
    return{ok:true,flights,count:flights.length};
  }catch(e){return{ok:false,error:e.message,flights:[]};}
}

function buildForecast(flights){
  const hourly=Array.from({length:24},(_,h)=>{const arr=flights.filter(f=>Math.floor(f.scheduledArr/60)===h);const dep=flights.filter(f=>Math.floor(f.actualDep/60)===h);return{hour:`${String(h).padStart(2,"0")}:00`,arrivals:arr.length,departures:dep.length,total:arr.length+dep.length,avgDelay:arr.length?+(arr.reduce((s,f)=>s+f.delay,0)/arr.length).toFixed(1):0,occupancy:Math.min(GATES.length,Math.round((arr.length+dep.length)*0.52))};});
  const rng2=seededRng(7);const trend=Array.from({length:30},(_,i)=>({day:i===29?"Today":`D-${29-i}`,movements:Math.round(flights.length*(0.85+rng2.next()*0.3)),avgGT:rng2.int(38,56),delays:rng2.int(8,34),utilization:rng2.int(58,90)}));
  return{hourly,trend};
}
function buildCarrierPerf(flights){
  return AIRLINES.map(al=>{
    const fs=flights.filter(f=>f.airline===al.code);if(!fs.length)return null;
    const avgGT=Math.round(fs.reduce((s,f)=>s+f.groundTime,0)/fs.length);const otp=Math.round(fs.filter(f=>f.delay<5).length/fs.length*100);const avgLoad=Math.round(fs.reduce((s,f)=>s+f.loadFactor,0)/fs.length);
    const byAC={};fs.forEach(f=>{if(!byAC[f.acType])byAC[f.acType]={type:f.acType,flights:[],count:0};byAC[f.acType].flights.push(f);byAC[f.acType].count++;});
    const acBreakdown=Object.values(byAC).map(ac=>{const acAvg=Math.round(ac.flights.reduce((s,f)=>s+f.groundTime,0)/ac.flights.length);const acOtp=Math.round(ac.flights.filter(f=>f.delay<5).length/ac.flights.length*100);const bm=AC_TYPES[ac.type]?.ground[0]||30;const overrun=acAvg-bm;return{type:ac.type,count:ac.count,avgGT:acAvg,otp:acOtp,benchmark:bm,overrun,performance:overrun>12?"poor":overrun>5?"average":"good",flights:ac.flights};}).sort((a,b)=>b.overrun-a.overrun);
    return{code:al.code,name:al.name,color:al.color,flights:fs.length,avgGT,otp,avgLoad,acBreakdown,draggingDown:acBreakdown.filter(a=>a.performance==="poor"),lifting:acBreakdown.filter(a=>a.performance==="good"),score:Math.round((otp*0.5)+(Math.max(0,100-(avgGT-30)*2)*0.5))};
  }).filter(Boolean).sort((a,b)=>b.flights-a.flights);
}

const fmt=m=>`${String(Math.floor(Math.abs(m)/60)%24).padStart(2,"0")}:${String(Math.floor(Math.abs(m)%60)).padStart(2,"0")}`;
const s2=n=>String(n).padStart(2,"0");

// ─── UI PRIMITIVES ───────────────────────────────────────────
function Card({children,style={}}){return <div style={{background:BG.surface,border:`1px solid ${BG.border}`,borderRadius:10,padding:"16px 20px",...style}}>{children}</div>;}
function KPI({label,value,sub,color=C.amber,icon:Icon,delta,mini}){return(<Card style={mini?{padding:"12px 14px"}:{}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:mini?6:10}}><span style={{fontSize:mini?9:10,color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace"}}>{label}</span>{Icon&&<Icon size={mini?12:14} color={color}/>}</div><div style={{fontSize:mini?20:26,fontWeight:800,color:"#F9FAFB",lineHeight:1}}>{value}</div>{sub&&<div style={{fontSize:mini?10:12,color:C.gray,marginTop:4}}>{sub}</div>}{delta!==undefined&&<div style={{fontSize:11,color:delta>=0?C.teal:C.red,marginTop:4,fontWeight:700}}>{delta>=0?"▲":"▼"} {Math.abs(delta).toFixed(1)}%</div>}</Card>);}
function StatusBadge({status}){const m={departed:{color:C.teal,label:"Departed"},"on-ground":{color:C.amber,label:"On Ground"},arriving:{color:C.blue,label:"Arriving"},scheduled:{color:C.gray,label:"Scheduled"}};const{color,label}=m[status]||m.scheduled;return <span style={{color,background:`${color}22`,border:`1px solid ${color}44`,fontSize:10,padding:"2px 7px",borderRadius:4,fontWeight:700,letterSpacing:"0.08em",fontFamily:"monospace"}}>{label}</span>;}
const TT=({active,payload,label})=>{if(!active||!payload?.length)return null;return(<div style={{background:"#1F2937",border:`1px solid ${BG.border}`,borderRadius:8,padding:"10px 14px",fontSize:12}}><div style={{color:"#9CA3AF",marginBottom:6,fontFamily:"monospace"}}>{label}</div>{payload.map((p,i)=><div key={i} style={{color:p.color||"#F9FAFB",marginBottom:3}}><span style={{color:"#6B7280"}}>{p.name}: </span>{typeof p.value==="number"?p.value.toFixed(1):p.value}</div>)}</div>);};
function InfoTip({content,color=C.cyan}){const[open,setOpen]=useState(false);return(<span style={{position:"relative",display:"inline-flex",verticalAlign:"middle",marginLeft:4}}><Info size={13} color={color} style={{cursor:"pointer",opacity:0.75}} onClick={()=>setOpen(o=>!o)}/>{open&&(<div style={{position:"absolute",zIndex:200,left:"calc(100% + 8px)",top:-6,background:"#1F2937",border:`1px solid ${color}44`,borderRadius:8,padding:"10px 14px",width:260,boxShadow:"0 8px 32px rgba(0,0,0,0.6)"}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:10,color,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase"}}>How it works</span><X size={12} color={C.gray} style={{cursor:"pointer"}} onClick={e=>{e.stopPropagation();setOpen(false);}}/></div><div style={{fontSize:12,color:"#D1D5DB",lineHeight:1.65}}>{content}</div></div>)}</span>);}
function Stepper({value,onChange,min=0,max=10,label,color=C.amber}){return(<div style={{display:"flex",alignItems:"center",gap:8}}><button onClick={()=>onChange(Math.max(min,value-1))} disabled={value<=min} style={{width:26,height:26,background:BG.border,border:"none",borderRadius:6,color:"#F9FAFB",cursor:value<=min?"not-allowed":"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",opacity:value<=min?0.4:1}}>−</button><div style={{textAlign:"center",minWidth:48}}><div style={{fontSize:16,fontWeight:800,color,fontFamily:"monospace"}}>{value}</div>{label&&<div style={{fontSize:9,color:C.gray,textTransform:"uppercase",letterSpacing:"0.08em"}}>{label}</div>}</div><button onClick={()=>onChange(Math.min(max,value+1))} disabled={value>=max} style={{width:26,height:26,background:BG.border,border:"none",borderRadius:6,color:"#F9FAFB",cursor:value>=max?"not-allowed":"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",opacity:value>=max?0.4:1}}>+</button></div>);}
function SeverityPill({s}){const m={high:{c:C.red,l:"HIGH"},medium:{c:C.amber,l:"MED"},low:{c:C.teal,l:"LOW"}};const{c,l}=m[s]||m.low;return <span style={{fontSize:9,padding:"2px 6px",borderRadius:3,fontFamily:"monospace",fontWeight:800,background:`${c}22`,color:c,border:`1px solid ${c}44`}}>{l}</span>;}
function IssueIcon({type}){const m={gate_conflict:<Layers size={13} color={C.red}/>,fuel_truck:<Truck size={13} color={C.amber}/>,staff_shortage:<Users size={13} color={C.purple}/>,delay_cascade:<AlertTriangle size={13} color={C.red}/>,long_turn:<Clock size={13} color={C.orange}/>};return m[type]||<AlertCircle size={13} color={C.gray}/>;}
function AiBlock({text}){if(!text)return null;return(<div style={{marginTop:14,background:BG.surface2,borderRadius:8,padding:"14px 18px",borderLeft:`3px solid ${C.amber}`}}>{text.split("\n").map((ln,i)=>{if(ln.startsWith("## "))return <div key={i} style={{color:C.amber,fontWeight:700,fontSize:13,letterSpacing:"0.06em",marginTop:i>0?14:0,marginBottom:4}}>{ln.replace("## ","")}</div>;if(ln.startsWith("**")&&ln.endsWith("**"))return <div key={i} style={{color:"#F9FAFB",fontWeight:600,fontSize:13,marginTop:6}}>{ln.slice(2,-2)}</div>;if(ln.startsWith("- ")||ln.startsWith("• "))return <div key={i} style={{color:"#D1D5DB",fontSize:13,lineHeight:1.7,paddingLeft:12,borderLeft:`2px solid ${BG.border}`,marginBottom:3}}>{ln.slice(2)}</div>;if(ln.trim()==="")return <div key={i} style={{height:6}}/>;return <div key={i} style={{color:"#9CA3AF",fontSize:13,lineHeight:1.7}}>{ln}</div>;})} </div>);}

// ─── REC CARD — reusable "AI fix plan" display ───────────────
function RecCard({rec, accent=C.teal}){
  if(!rec) return null;
  return(
    <div style={{marginTop:10,background:`${accent}08`,border:`1px solid ${accent}33`,borderRadius:8,padding:"14px 16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <Lightbulb size={14} color={accent}/>
        <span style={{fontSize:12,color:accent,fontWeight:700,letterSpacing:"0.05em"}}>AI FIX PLAN</span>
        {rec.urgency&&<span style={{fontSize:10,color:C.orange,background:`${C.orange}22`,border:`1px solid ${C.orange}44`,borderRadius:4,padding:"2px 7px",fontFamily:"monospace",marginLeft:"auto"}}>{rec.urgency}</span>}
      </div>
      {rec.rootCause&&<div style={{fontSize:12,color:"#9CA3AF",marginBottom:10,lineHeight:1.6,padding:"6px 10px",background:BG.page,borderRadius:6,borderLeft:`2px solid ${BG.border}`}}><span style={{color:"#6B7280",fontWeight:600}}>Root cause: </span>{rec.rootCause}</div>}
      <div style={{marginBottom:10}}>
        {rec.steps?.map((step,i)=>(
          <div key={i} style={{display:"flex",gap:10,marginBottom:6}}>
            <div style={{width:18,height:18,borderRadius:"50%",background:`${accent}33`,border:`1px solid ${accent}55`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>
              <span style={{fontSize:9,color:accent,fontWeight:800}}>{i+1}</span>
            </div>
            <span style={{fontSize:12,color:"#D1D5DB",lineHeight:1.6}}>{step}</span>
          </div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,fontSize:11}}>
        {rec.saving&&<div style={{background:BG.surface2,borderRadius:6,padding:"7px 10px"}}><div style={{color:C.gray,fontSize:9,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>Expected Saving</div><div style={{color:C.teal,fontWeight:700}}>{rec.saving}</div></div>}
        {rec.cost&&<div style={{background:BG.surface2,borderRadius:6,padding:"7px 10px"}}><div style={{color:C.gray,fontSize:9,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>Cost</div><div style={{color:"#F9FAFB",fontWeight:600}}>{rec.cost}</div></div>}
        {rec.owner&&<div style={{background:BG.surface2,borderRadius:6,padding:"7px 10px"}}><div style={{color:C.gray,fontSize:9,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3}}>Owner</div><div style={{color:"#9CA3AF"}}>{rec.owner}</div></div>}
      </div>
      {rec.kpi&&<div style={{marginTop:8,fontSize:11,color:C.cyan,padding:"5px 10px",background:`${C.cyan}11`,borderRadius:6}}><span style={{color:"#6B7280"}}>KPI: </span>{rec.kpi}</div>}
    </div>
  );
}

// ─── SMART INSIGHTS PANEL ────────────────────────────────────
function SmartInsightsPanel({flights, issues, simResult}){
  const insights=useMemo(()=>synthesizeInsights(flights,issues,simResult),[flights,issues,simResult]);
  const [expanded,setExpanded]=useState(0);
  if(!insights.length) return null;
  const totalImpact=insights.reduce((s,ins)=>{const m=ins.impact?.match(/(\d+[\.,]?\d*)\s*min/);return s+(m?parseInt(m[1]):0);},0);
  return(
    <Card style={{marginBottom:16,border:`1px solid ${C.amber}44`}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <div style={{background:`${C.amber}22`,border:`1px solid ${C.amber}44`,borderRadius:8,padding:"6px 10px",display:"flex",alignItems:"center",gap:6}}>
          <Cpu size={14} color={C.amber}/>
          <span style={{fontSize:12,color:C.amber,fontWeight:800,fontFamily:"monospace"}}>VCE INTELLIGENCE</span>
        </div>
        <div><div style={{fontSize:13,fontWeight:700,color:"#F9FAFB"}}>{insights.length} Patterns Detected Across {flights.length} Flights</div>
          <div style={{fontSize:11,color:C.gray}}>~{totalImpact} min/day total recoverable · click each finding to see action plan</div></div>
      </div>
      {insights.map((ins,i)=>{
        const Icon=ins.icon||Lightbulb;const isExp=expanded===i;
        return(
          <div key={i} style={{marginBottom:10,border:`1px solid ${isExp?ins.color:BG.border}`,borderRadius:8,overflow:"hidden"}}>
            <div style={{padding:"12px 16px",cursor:"pointer",background:isExp?`${ins.color}08`:BG.surface2,display:"flex",alignItems:"flex-start",gap:12}} onClick={()=>setExpanded(isExp?-1:i)}>
              <div style={{width:32,height:32,borderRadius:8,background:`${ins.color}22`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:`1px solid ${ins.color}44`}}>
                <Icon size={15} color={ins.color}/>
              </div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:4}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#F9FAFB"}}>{ins.headline}</div>
                  <span style={{fontSize:10,color:ins.color,background:`${ins.color}22`,border:`1px solid ${ins.color}44`,borderRadius:4,padding:"2px 8px",fontFamily:"monospace",fontWeight:700,flexShrink:0,whiteSpace:"nowrap"}}>P{ins.priority}</span>
                </div>
                <div style={{fontSize:12,color:C.teal,fontWeight:600}}>{ins.impact}</div>
              </div>
              <ChevronRight size={14} color={C.gray} style={{flexShrink:0,transform:isExp?"rotate(90deg)":"none",transition:"transform 0.2s"}}/>
            </div>
            {isExp&&(
              <div style={{padding:"14px 16px",borderTop:`1px solid ${BG.border}`}}>
                <div style={{fontSize:12,color:"#9CA3AF",lineHeight:1.7,marginBottom:12,padding:"8px 12px",background:BG.page,borderRadius:6,borderLeft:`2px solid ${ins.color}55`}}>{ins.finding}</div>
                <div style={{background:`${ins.color}11`,border:`1px solid ${ins.color}33`,borderRadius:6,padding:"10px 14px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><Zap size={12} color={ins.color}/><span style={{fontSize:11,color:ins.color,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em"}}>Recommended Action</span></div>
                  <div style={{fontSize:13,color:"#D1D5DB",lineHeight:1.7}}>{ins.action}</div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}

// ─── ENHANCED ISSUE PANEL ────────────────────────────────────
function IssuePanel({issues, flights, title, accent=C.red}){
  const [expanded,setExpanded]=useState(null);
  const [filter,setFilter]=useState("all");
  const [showRec,setShowRec]=useState({});
  const types=["all","gate_conflict","fuel_truck","staff_shortage","delay_cascade","long_turn"];
  const filtered=filter==="all"?issues:issues.filter(i=>i.type===filter);
  const grouped=useMemo(()=>{const g={};filtered.forEach(i=>{if(!g[i.flight])g[i.flight]=[];g[i.flight].push(i);});return Object.entries(g).sort((a,b)=>b[1].reduce((s,i)=>s+i.impact,0)-a[1].reduce((s,i)=>s+i.impact,0));},[filtered]);
  const totalImpact=Math.round(filtered.reduce((s,i)=>s+i.impact,0));
  return(<Card>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12,flexWrap:"wrap",gap:8}}>
      <div><div style={{fontSize:13,fontWeight:700,color:"#F9FAFB"}}>{title}</div><div style={{fontSize:11,color:C.gray}}>{issues.length} issues · ~{totalImpact} min impact/day · click flight to expand · click "Fix Plan" for AI recommendations</div></div>
      <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{types.map(t=><button key={t} onClick={()=>setFilter(t)} style={{fontSize:9,padding:"3px 7px",borderRadius:4,border:`1px solid ${filter===t?accent:BG.border}`,background:filter===t?`${accent}22`:"none",color:filter===t?accent:C.gray,cursor:"pointer",fontFamily:"monospace",textTransform:"uppercase"}}>{t.replace(/_/g," ")}</button>)}</div>
    </div>
    {grouped.length===0&&<div style={{color:C.gray,fontSize:13,textAlign:"center",padding:"20px 0"}}>No issues detected ✓</div>}
    {grouped.map(([fid,fIssues])=>{
      const fl=flights?.find(f=>f.id===fid);const tfi=Math.round(fIssues.reduce((s,i)=>s+i.impact,0));const isExp=expanded===fid;
      return(<div key={fid} style={{marginBottom:8,border:`1px solid ${isExp?accent:BG.border}`,borderRadius:8,overflow:"hidden"}}>
        <div style={{padding:"10px 14px",cursor:"pointer",background:isExp?`${accent}08`:BG.surface2,display:"flex",alignItems:"center",gap:12}} onClick={()=>setExpanded(isExp?null:fid)}>
          <div style={{fontFamily:"monospace",fontWeight:700,color:fl?.airlineColor||"#F9FAFB",fontSize:13,minWidth:60}}>{fid}</div>
          {fl&&<div style={{fontSize:11,color:C.gray}}>{fl.acType} · {fl.origin}→{fl.destination} · {fmt(fl.scheduledArr)}</div>}
          <div style={{flex:1,display:"flex",gap:5}}>{fIssues.map((iss,ii)=><span key={ii}><IssueIcon type={iss.type}/></span>)}</div>
          <div style={{fontSize:12,color:accent,fontWeight:700,fontFamily:"monospace"}}>~{tfi} min</div>
          <ChevronRight size={13} color={C.gray} style={{transform:isExp?"rotate(90deg)":"none",transition:"transform 0.2s"}}/>
        </div>
        {isExp&&(<div style={{padding:"10px 14px",borderTop:`1px solid ${BG.border}`}}>
          {fIssues.map((iss,ii)=>{
            const recKey=`${fid}-${ii}`;const recOpen=showRec[recKey];
            const rec=fl?generateIssueRec(iss,fl,flights):null;
            return(<div key={ii} style={{marginBottom:12,padding:"10px 12px",background:BG.page,borderRadius:8,border:`1px solid ${iss.severity==="high"?C.red+"44":iss.severity==="medium"?C.amber+"44":C.teal+"44"}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <IssueIcon type={iss.type}/>
                <span style={{fontSize:12,color:"#F9FAFB",fontWeight:700}}>{iss.type.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}</span>
                <SeverityPill s={iss.severity}/>
                <span style={{fontSize:11,color:C.amber,fontFamily:"monospace",marginLeft:"auto"}}>~{Math.round(iss.impact)} min</span>
                {rec&&<button onClick={()=>setShowRec(r=>({...r,[recKey]:!r[recKey]}))}
                  style={{background:recOpen?`${C.teal}22`:`${C.teal}11`,color:C.teal,border:`1px solid ${C.teal}44`,borderRadius:5,padding:"3px 10px",fontSize:10,cursor:"pointer",fontWeight:700,display:"flex",alignItems:"center",gap:4,fontFamily:"monospace"}}>
                  <Lightbulb size={10}/>{recOpen?"Hide Fix":"Fix Plan"}
                </button>}
              </div>
              <div style={{fontSize:12,color:"#9CA3AF",marginBottom:4}}>{iss.msg}</div>
              {rec&&!recOpen&&<div style={{fontSize:11,color:C.teal,display:"flex",alignItems:"flex-start",gap:5,padding:"5px 8px",background:`${C.teal}08`,borderRadius:5}}><Zap size={10} color={C.teal} style={{flexShrink:0,marginTop:2}}/>{rec.steps?.[0]||iss.recommendation}</div>}
              {rec&&recOpen&&<RecCard rec={rec} accent={iss.severity==="high"?C.red:iss.severity==="medium"?C.amber:C.teal}/>}
            </div>);})}
        </div>)}
      </div>);
    })}
  </Card>);}

// ─── FLIGHT IMPROVEMENT TABLE ────────────────────────────────
function FlightImprovementTable({simFlights,flights}){
  const [sort,setSort]=useState("improvement");const [filter,setFilter]=useState("all");const [expandedFlight,setExpandedFlight]=useState(null);
  const data=simFlights.map(sf=>{const b=flights.find(f=>f.id===sf.id)||sf;return{...sf,baseGT:b.groundTime,baseDelay:b.delay};});
  const sorted=[...data].sort((a,b)=>sort==="improvement"?b.improvement-a.improvement:sort==="gt"?b.simGT-a.simGT:b.simDelay-a.simDelay);
  const filtered=filter==="all"?sorted:filter==="improved"?sorted.filter(f=>f.improvement>0):sorted.filter(f=>f.improvement<=0);
  const sc={improved:C.teal,marginal:C.amber,unchanged:C.gray,degraded:C.red};
  return(<Card>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
      <div>
        <div style={{fontSize:13,fontWeight:700,color:"#F9FAFB"}}>Flight-by-Flight Improvement</div>
        <div style={{fontSize:11,color:C.gray}}>{simFlights.filter(f=>f.improvement>0).length} improved · {simFlights.filter(f=>f.improvement<=0).length} unchanged/degraded · click any row for AI recommendations</div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <select value={sort} onChange={e=>setSort(e.target.value)} style={{background:BG.surface2,color:"#F9FAFB",border:`1px solid ${BG.border}`,borderRadius:6,padding:"4px 10px",fontSize:12,fontFamily:"monospace"}}>
          <option value="improvement">Most Improved</option><option value="gt">Ground Time</option><option value="delay">Delay</option>
        </select>
        {["all","improved","other"].map(f=><button key={f} onClick={()=>setFilter(f)} style={{fontSize:11,padding:"4px 9px",borderRadius:4,border:`1px solid ${filter===f?C.amber:BG.border}`,background:filter===f?`${C.amber}22`:"none",color:filter===f?C.amber:C.gray,cursor:"pointer",fontFamily:"monospace"}}>{f}</button>)}
      </div>
    </div>
    <div style={{overflowX:"auto",maxHeight:520,overflowY:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead style={{position:"sticky",top:0,background:BG.surface}}>
          <tr style={{borderBottom:`1px solid ${BG.border}`}}>
            {["Flight","AC","Gate→Sim","Base GT","Sim GT","Δ GT","Base Delay","Sim Delay","Fuel Wait","Staff","Status","AI Rec"].map(h=>(
              <th key={h} style={{color:C.gray,padding:"6px 10px",textAlign:"left",fontSize:9,fontFamily:"monospace",letterSpacing:"0.08em",whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{filtered.slice(0,80).map((f,i)=>{
          const isExp=expandedFlight===f.id;const rec=generateFlightRec(f);
          return(<>
            <tr key={f.id} style={{borderBottom:isExp?`none`:`1px solid ${BG.surface2}`,background:isExp?`${C.amber}08`:i%2===0?"transparent":BG.surface2,cursor:"pointer"}} onClick={()=>setExpandedFlight(isExp?null:f.id)}>
              <td style={{padding:"6px 10px",color:f.airlineColor,fontWeight:700,fontFamily:"monospace",whiteSpace:"nowrap"}}>{f.id}</td>
              <td style={{padding:"6px 10px",color:"#9CA3AF",fontFamily:"monospace"}}>{f.acType}</td>
              <td style={{padding:"6px 10px",color:f.gate!==f.assignedGate?C.teal:"#6B7280",fontFamily:"monospace",fontSize:10}}>{f.gate}{f.gate!==f.assignedGate?`→${f.assignedGate}`:""}</td>
              <td style={{padding:"6px 10px",color:"#D1D5DB",fontFamily:"monospace"}}>{f.baseGT}m</td>
              <td style={{padding:"6px 10px",fontFamily:"monospace",fontWeight:600,color:f.simGT<f.baseGT?C.teal:f.simGT>f.baseGT?C.red:"#D1D5DB"}}>{f.simGT}m</td>
              <td style={{padding:"6px 10px",fontFamily:"monospace",fontWeight:700,color:f.improvement>0?C.teal:f.improvement<0?C.red:C.gray}}>{f.improvement>0?`−${f.improvement}`:f.improvement<0?`+${Math.abs(f.improvement)}`:0}m</td>
              <td style={{padding:"6px 10px",color:f.baseDelay>15?C.red:f.baseDelay>5?C.amber:C.gray,fontFamily:"monospace"}}>{f.baseDelay>0?`+${f.baseDelay}m`:"—"}</td>
              <td style={{padding:"6px 10px",color:f.simDelay>15?C.red:f.simDelay>5?C.amber:C.teal,fontFamily:"monospace"}}>{f.simDelay>0?`+${Math.round(f.simDelay)}m`:"—"}</td>
              <td style={{padding:"6px 10px",color:f.fuelWait>0?C.amber:C.gray,fontFamily:"monospace",fontSize:11}}>{f.fuelWait>0?`+${f.fuelWait}m`:"—"}</td>
              <td style={{padding:"6px 10px",color:f.staffWait>0?C.purple:C.gray,fontFamily:"monospace",fontSize:11}}>{f.staffWait>0?`+${f.staffWait}m`:"—"}</td>
              <td style={{padding:"6px 10px"}}><span style={{fontSize:10,padding:"2px 7px",borderRadius:4,fontFamily:"monospace",fontWeight:700,background:`${sc[f.simStatus]||C.gray}22`,color:sc[f.simStatus]||C.gray}}>{f.simStatus}</span></td>
              <td style={{padding:"6px 10px"}}><span style={{fontSize:9,color:C.amber,background:`${C.amber}15`,border:`1px solid ${C.amber}33`,borderRadius:4,padding:"2px 7px",fontFamily:"monospace",cursor:"pointer"}}>{isExp?"▲ hide":"▼ view"}</span></td>
            </tr>
            {isExp&&rec&&<tr key={`${f.id}-rec`}><td colSpan={12} style={{padding:"0 10px 14px",background:`${C.amber}05`,borderBottom:`1px solid ${BG.border}`}}>
              <div style={{paddingTop:12}}>
                {rec.reasons.length>0&&<div style={{marginBottom:10}}>
                  <div style={{fontSize:11,color:C.gray,letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:6}}>Analysis</div>
                  {rec.reasons.map((r,ri)=><div key={ri} style={{fontSize:12,color:"#9CA3AF",display:"flex",gap:6,marginBottom:4,lineHeight:1.6}}><span style={{color:BG.border}}>•</span>{r}</div>)}
                </div>}
                {rec.actions.length>0&&<div style={{marginBottom:10}}>
                  <div style={{fontSize:11,color:C.amber,letterSpacing:"0.08em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:8}}>Recommended Actions</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:8}}>
                    {rec.actions.map((a,ai)=>(
                      <div key={ai} style={{background:BG.surface,border:`1px solid ${BG.border}`,borderRadius:6,padding:"8px 12px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span style={{fontSize:11,color:"#F9FAFB",fontWeight:700}}>{a.label}</span>
                          <span style={{fontSize:11,color:C.teal,fontFamily:"monospace",fontWeight:700}}>−{a.saving} min</span>
                        </div>
                        <div style={{fontSize:11,color:"#9CA3AF",lineHeight:1.5}}>{a.detail}</div>
                      </div>
                    ))}
                  </div>
                </div>}
                {rec.totalPotential>0&&<div style={{display:"flex",gap:12,fontSize:12}}>
                  <div style={{background:`${C.teal}11`,border:`1px solid ${C.teal}33`,borderRadius:6,padding:"5px 12px",color:C.teal,fontWeight:700}}>Total potential: −{rec.totalPotential} min</div>
                  <div style={{background:`${C.lime}11`,border:`1px solid ${C.lime}33`,borderRadius:6,padding:"5px 12px",color:C.lime,fontWeight:700}}>R$ value: ~R${rec.rValue.toLocaleString()}/rotation</div>
                </div>}
              </div>
            </td></tr>}
          </>);
        })}</tbody>
      </table>
    </div>
    {filtered.length>80&&<div style={{textAlign:"center",color:C.gray,fontSize:11,marginTop:8}}>Showing 80 of {filtered.length} flights</div>}
  </Card>);}

// ═══════════════════════════════════════════════════════════════
// SCENARIO SIMULATOR
// ═══════════════════════════════════════════════════════════════
function ScenarioSimulator({flights:extFlights,baseline}){
  const [useUserData,setUseUserData]=useState(false);const [csvText,setCsvText]=useState("");const [csvParsed,setCsvParsed]=useState(null);const [csvError,setCsvError]=useState("");const [showCSVHelp,setShowCSVHelp]=useState(false);
  const flights=useMemo(()=>{if(useUserData&&csvParsed?.ok&&csvParsed.flights.length>0)return csvParsed.flights;return extFlights||FLIGHTS;},[useUserData,csvParsed,extFlights]);
  const [cfg,setCfg]=useState({reduceTurnaround:0,optimizeGates:false,virtualRunway:false,extraRunway:0,extraFuelTrucks:0,extraStaff:0,weatherDisruption:false});
  const [result,setResult]=useState(null);const [running,setRunning]=useState(false);const [activeTab,setActiveTab]=useState("insights");
  const baseIssues=useMemo(()=>detectIssues(flights),[flights]);
  const highIssues=useMemo(()=>baseIssues.filter(i=>i.severity==="high"),[baseIssues]);
  const run=()=>{setRunning(true);setTimeout(()=>{setResult(runAdvancedDES(flights,cfg));setRunning(false);setActiveTab("insights");},900);};
  const setC=useCallback((k,v)=>setCfg(c=>({...c,[k]:v})),[]);
  const simInsights=useMemo(()=>result?synthesizeInsights(result.flights,result.issues,result):[],[result]);
  const compData=result?[{name:"Avg GT",baseline:baseline.avgGT,simulated:result.stats.avgGT},{name:"Avg Delay",baseline:+baseline.avgDelay,simulated:+result.stats.avgDelay},{name:"Conflicts",baseline:baseline.conflicts,simulated:result.stats.conflicts},{name:"Utilisation",baseline:+baseline.utilization,simulated:+result.stats.utilization},{name:"Issues",baseline:result.stats.issuesResolved+result.stats.issuesRemaining,simulated:result.stats.issuesRemaining}]:[];
  const tabSty=a=>({background:"none",border:"none",borderBottom:`2px solid ${a?C.amber:"transparent"}`,color:a?"#F9FAFB":C.gray,padding:"8px 16px",fontSize:12,fontWeight:a?700:400,cursor:"pointer",whiteSpace:"nowrap"});
  const csvTemplate=`airline,aircraft,arrival,ground_time,delay,gate,origin,dest\nLA,A320,07:15,45,0,G01,CGH,SDU\nG3,B737,07:45,52,8,G02,POA,GRU\nAD,E195,08:00,32,0,G13,BSB,GRU`;
  return(<div>
    <div style={{background:`${C.cyan}11`,border:`1px solid ${C.cyan}33`,borderRadius:8,padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
      <Cpu size={14} color={C.cyan}/><span style={{fontSize:12,color:C.cyan,fontFamily:"monospace",fontWeight:700}}>VCE Advanced DES Engine v2</span>
      <InfoTip content="Discrete Event Simulation models GRU as queuing network: RUNWAY_ARR → TAXI → GATE(n) → ground services → PUSHBACK → RUNWAY_DEP. Resource contention modelled: fuel trucks, ground staff, gate slots, runway capacity." color={C.cyan}/>
      <span style={{fontSize:12,color:"#6B7280"}}>7 levers · AI fix plans per issue · flight-level recommendations · pattern synthesis</span>
      {highIssues.length>0&&<div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,background:`${C.red}11`,border:`1px solid ${C.red}33`,borderRadius:6,padding:"4px 10px"}}>
        <Flame size={13} color={C.red}/><span style={{fontSize:12,color:C.red,fontWeight:700}}>{highIssues.length} critical issues detected</span>
      </div>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"300px 1fr",gap:16}}>
      {/* LEFT — controls */}
      <div>
        <Card style={{marginBottom:12}}>
          <div style={{fontSize:11,color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:12}}>Data Source</div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <button onClick={()=>setUseUserData(false)} style={{flex:1,padding:"8px",border:`1px solid ${!useUserData?C.amber:BG.border}`,borderRadius:6,background:!useUserData?`${C.amber}22`:"none",color:!useUserData?C.amber:C.gray,fontSize:12,cursor:"pointer",fontWeight:!useUserData?700:400}}><Database size={12} style={{verticalAlign:"middle",marginRight:4}}/>Synthetic GRU</button>
            <button onClick={()=>setUseUserData(true)} style={{flex:1,padding:"8px",border:`1px solid ${useUserData?C.teal:BG.border}`,borderRadius:6,background:useUserData?`${C.teal}22`:"none",color:useUserData?C.teal:C.gray,fontSize:12,cursor:"pointer",fontWeight:useUserData?700:400}}><Upload size={12} style={{verticalAlign:"middle",marginRight:4}}/>Your Data</button>
          </div>
          {useUserData&&<div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,color:"#9CA3AF"}}>Paste CSV</span><button onClick={()=>setShowCSVHelp(v=>!v)} style={{fontSize:10,color:C.cyan,background:"none",border:"none",cursor:"pointer",textDecoration:"underline"}}>format guide</button></div>
            {showCSVHelp&&<div style={{background:BG.page,borderRadius:6,padding:"8px",marginBottom:8,fontSize:10,fontFamily:"monospace",color:"#9CA3AF",whiteSpace:"pre-wrap"}}>{csvTemplate}</div>}
            <textarea value={csvText} onChange={e=>setCsvText(e.target.value)} rows={4} placeholder="airline,aircraft,arrival,ground_time,delay..." style={{width:"100%",background:BG.surface2,color:"#F9FAFB",border:`1px solid ${csvError?C.red:BG.border}`,borderRadius:6,padding:"8px",fontSize:11,fontFamily:"monospace",resize:"vertical",boxSizing:"border-box"}}/>
            <button onClick={()=>{const r=parseUserCSV(csvText);setCsvParsed(r);setCsvError(r.ok?"":r.error);}} style={{width:"100%",marginTop:6,background:`${C.teal}22`,color:C.teal,border:`1px solid ${C.teal}44`,borderRadius:6,padding:"7px",fontSize:12,cursor:"pointer",fontWeight:700}}>Load{csvParsed?.ok?` (${csvParsed.count} flights ✓)`:""}</button>
            {csvError&&<div style={{color:C.red,fontSize:11,marginTop:4}}>{csvError}</div>}
          </div>}
          {!useUserData&&<div style={{fontSize:11,color:C.gray}}>{flights.length} synthetic GRU flights (deterministic seed)</div>}
        </Card>
        <Card style={{marginBottom:12}}>
          <div style={{fontSize:11,color:C.amber,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:14}}>Operational Levers</div>
          <div style={{marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",marginBottom:6}}><Clock size={13} color={C.amber} style={{marginRight:6}}/><span style={{fontSize:12,color:"#9CA3AF",flex:1}}>Turnaround Reduction</span><InfoTip content="Compresses ground time % above aircraft minimums. Models parallel fuel+deplaning, predictive crew dispatch (T−25 vs T−8), SOP milestone compression."/><span style={{fontSize:13,fontWeight:700,color:C.amber,fontFamily:"monospace",marginLeft:6}}>{cfg.reduceTurnaround}%</span></div>
            <input type="range" min={0} max={35} step={1} value={cfg.reduceTurnaround} onChange={e=>setC("reduceTurnaround",+e.target.value)} style={{width:"100%",accentColor:C.amber}}/>
            {cfg.reduceTurnaround>0&&<div style={{fontSize:11,color:C.teal,marginTop:4}}>≈ −{Math.round(baseline.avgGT*cfg.reduceTurnaround/100)} min avg · R${Math.round(baseline.avgGT*cfg.reduceTurnaround/100*flights.length*150/1000)}K/day</div>}
          </div>
          {[{key:"optimizeGates",label:"Gate Optimisation",icon:Layers,onColor:C.teal,info:"CP-SAT constraint solver: conflict-free gate assignment with 55-min lookahead, 8-min buffer enforced.",effect:"−78% conflicts · −5.2 min/dep"},
            {key:"virtualRunway",label:"Virtual Runway",icon:Wind,onColor:C.cyan,info:"EOBT-ordered pushback sequence + taxi de-confliction. No ATC separation changes — ground side only.",effect:"+1.4 mov/hr · −3.8 min taxi"},
            {key:"weatherDisruption",label:"Weather Disruption",icon:AlertTriangle,onColor:C.orange,info:"Applies 25% runway capacity penalty. Tests system resilience under IMC conditions.",effect:"−25% runway cap · stress test"}
          ].map(opt=>{const Icon=opt.icon;const on=cfg[opt.key];return(
            <div key={opt.key} style={{marginBottom:10,padding:"10px 12px",background:BG.surface2,borderRadius:8,border:on?`1px solid ${opt.onColor}44`:`1px solid ${BG.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:on?4:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}><Icon size={13} color={on?opt.onColor:C.gray}/><span style={{fontSize:12,color:on?"#F9FAFB":"#9CA3AF",fontWeight:600}}>{opt.label}</span><InfoTip content={opt.info} color={opt.onColor}/></div>
                <button onClick={()=>setC(opt.key,!on)} style={{background:on?opt.onColor:BG.border,color:on?(opt.key==="virtualRunway"?"#000":"#fff"):"#6B7280",border:"none",borderRadius:16,padding:"3px 12px",fontSize:11,cursor:"pointer",fontWeight:700,fontFamily:"monospace"}}>{on?"ON":"OFF"}</button>
              </div>
              {on&&<div style={{fontSize:11,color:opt.onColor}}>↳ {opt.effect}</div>}
            </div>);})}
        </Card>
        <Card style={{marginBottom:12}}>
          <div style={{fontSize:11,color:C.blue,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:14}}>Infrastructure & Resources</div>
          {[{key:"extraRunway",label:"Additional Runways",icon:Radio,color:C.blue,max:2,info:"Each runway adds ~10 movements/hour. R$1.2–1.8B capex, 4.3yr payback at current load.",sub:v=>v>0?`+${v} runway → +${v*10} mov/hr · R${v===1?"1.2–1.8":"2.4–3.6"}B capex`:null},
            {key:"extraFuelTrucks",label:"Extra Fuel Trucks",icon:Truck,color:C.amber,max:4,info:"Each truck reduces contention events. Current 6 trucks see ~31% contention rate at peak. R$380K/yr each.",sub:v=>v>0?`+${v} truck · −${Math.round(v*1.8)}m avg wait · R${v*380}K/yr`:null},
            {key:"extraStaff",label:"Handler Teams",icon:Users,color:C.purple,max:5,info:"Each team = 6 ground staff. Adding teams reduces peak sequential service bottlenecks.",sub:v=>v>0?`+${v} team (+${v*6} staff) · R${v*920}K/yr`:null}
          ].map(opt=>{const Icon=opt.icon;const v=cfg[opt.key];const sub=opt.sub(v);return(
            <div key={opt.key} style={{marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}><Icon size={13} color={v>0?opt.color:C.gray}/><span style={{fontSize:12,color:"#9CA3AF"}}>{opt.label}</span><InfoTip content={opt.info} color={opt.color}/></div>
                <Stepper value={v} onChange={nv=>setC(opt.key,nv)} min={0} max={opt.max} color={opt.color}/>
              </div>
              {sub&&<div style={{fontSize:11,color:opt.color,padding:"5px 10px",background:`${opt.color}11`,borderRadius:6}}>{sub}</div>}
            </div>);})}
        </Card>
        <button onClick={run} disabled={running} style={{width:"100%",background:running?"#374151":C.amber,color:running?C.gray:"#000",border:"none",borderRadius:8,padding:"13px",fontWeight:800,fontSize:14,cursor:running?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"monospace",marginBottom:12}}>
          {running?<><RefreshCw size={14} style={{animation:"spin 1s linear infinite"}}/>Running DES...</>:<><Play size={14}/>Run Simulation</>}
        </button>
        <Card>
          <div style={{fontSize:11,color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:10}}>Baseline · {flights.length} flights</div>
          {[["Avg GT",`${baseline.avgGT} min`],["Avg Delay",`${baseline.avgDelay} min`],["Conflicts",baseline.conflicts],["Utilisation",`${baseline.utilization}%`],["Issues",baseIssues.length],["High Severity",highIssues.length]].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${BG.border}`,fontSize:12}}><span style={{color:C.gray}}>{k}</span><span style={{color:k==="High Severity"&&v>0?C.red:k==="Issues"&&v>0?C.amber:"#F9FAFB",fontFamily:"monospace",fontWeight:600}}>{v}</span></div>
          ))}
        </Card>
      </div>

      {/* RIGHT — results */}
      <div>
        {/* Pre-run: smart insights + issues */}
        {!result&&(<>
          <SmartInsightsPanel flights={flights} issues={baseIssues} simResult={null}/>
          <Card style={{marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
              <Flame size={18} color={C.red}/>
              <div><div style={{fontSize:14,fontWeight:700,color:"#F9FAFB"}}>Pre-Simulation Issue Scan — {baseIssues.length} Issues Detected</div><div style={{fontSize:12,color:C.gray}}>Each issue has an AI fix plan. Configure levers and run to see what gets resolved.</div></div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
              {[{l:"Gate Conflicts",t:"gate_conflict",c:C.red,I:Layers},{l:"Fuel Waits",t:"fuel_truck",c:C.amber,I:Truck},{l:"Staff Gaps",t:"staff_shortage",c:C.purple,I:Users},{l:"Delay Cascades",t:"delay_cascade",c:C.orange,I:AlertTriangle}].map(({l,t,c,I})=>{
                const v=baseIssues.filter(i=>i.type===t).length;
                return(<div key={t} style={{background:BG.surface2,borderRadius:8,padding:"10px 14px",border:`1px solid ${v>0?`${c}33`:BG.border}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><I size={13} color={c}/><span style={{fontSize:9,color:C.gray,fontFamily:"monospace",textTransform:"uppercase"}}>{l}</span></div>
                  <div style={{fontSize:22,fontWeight:800,color:v>0?c:"#9CA3AF"}}>{v}</div>
                </div>);
              })}
            </div>
          </Card>
          <IssuePanel issues={baseIssues} flights={flights} title="Current Operations — AI Fix Plans Available" accent={C.red}/>
        </>)}

        {result&&(<>
          <div style={{display:"flex",gap:0,borderBottom:`1px solid ${BG.border}`,marginBottom:16,overflowX:"auto"}}>
            {[["insights","AI Insights"],["overview","Overview"],["flightwise","Flight-by-Flight"],["issues","Issues"],["resources","Resources"]].map(([id,label])=>(
              <button key={id} onClick={()=>setActiveTab(id)} style={tabSty(activeTab===id)}>{label}</button>
            ))}
          </div>

          {/* AI INSIGHTS TAB — now the default */}
          {activeTab==="insights"&&(<>
            <SmartInsightsPanel flights={result.flights} issues={result.issues} simResult={result}/>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
              {[{label:"GT Saved",val:`${baseline.avgGT-result.stats.avgGT} min/flt`,color:C.teal,icon:Clock},{label:"Issues Resolved",val:result.stats.issuesResolved,color:C.lime,icon:CheckCircle},{label:"Issues Remaining",val:result.stats.issuesRemaining,color:result.stats.issuesRemaining>0?C.amber:C.teal,icon:AlertCircle},{label:"Annual R$ Impact",val:`R$${(result.stats.financialImpact*250/1e6).toFixed(1)}M`,color:C.lime,icon:TrendingUp}].map(({label,val,color,icon:Icon})=>(
                <div key={label} style={{background:BG.surface2,border:`1px solid ${BG.border}`,borderRadius:8,padding:"12px 14px"}}><div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}><Icon size={13} color={color}/><span style={{fontSize:9,color:C.gray,fontFamily:"monospace",textTransform:"uppercase"}}>{label}</span></div><div style={{fontSize:20,fontWeight:800,color}}>{val}</div></div>
              ))}
            </div>
            <IssuePanel issues={result.issues} flights={result.flights} title="Remaining Issues — AI Fix Plans" accent={C.amber}/>
          </>)}

          {activeTab==="overview"&&(<>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:12}}>
              {[{label:"Avg Ground Time",val:`${result.stats.avgGT}m`,delta:result.stats.avgGT-baseline.avgGT,good:-1},{label:"Avg Delay",val:`${result.stats.avgDelay}m`,delta:+(result.stats.avgDelay-baseline.avgDelay).toFixed(1),good:-1},{label:"Mins Saved/Day",val:result.stats.totalSaved},{label:"Extra Flights",val:`+${result.stats.extraFlights}`}].map(item=>(
                <Card key={item.label} style={{padding:"12px 14px"}}><div style={{fontSize:9,color:C.gray,fontFamily:"monospace",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6}}>{item.label}</div><div style={{fontSize:22,fontWeight:800,color:"#F9FAFB"}}>{item.val}</div>{item.delta!==undefined&&<div style={{fontSize:12,fontWeight:700,marginTop:4,color:item.delta*(item.good||1)>0?C.teal:C.red}}>{item.delta>0?"+":""}{item.delta} vs baseline</div>}</Card>
              ))}
            </div>
            <Card style={{marginBottom:12}}>
              <div style={{fontSize:12,color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:14}}>Baseline vs. Simulated</div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={compData} margin={{top:5,right:20,bottom:5,left:0}}><CartesianGrid stroke={BG.border} strokeDasharray="3 3"/><XAxis dataKey="name" tick={{fill:C.gray,fontSize:10}}/><YAxis tick={{fill:C.gray,fontSize:10}}/><Tooltip content={<TT/>}/><Legend wrapperStyle={{fontSize:11,color:C.gray}}/>
                  <Bar dataKey="baseline" name="Baseline" fill={`${C.red}88`} radius={[4,4,0,0]}/><Bar dataKey="simulated" name="Simulated" fill={`${C.teal}99`} radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card style={{marginBottom:12}}>
              <div style={{fontSize:12,color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:14}}>Simulated Hourly Profile</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={result.hourly.filter(h=>h.movements>0)} margin={{top:5,right:20,bottom:5,left:0}}><CartesianGrid stroke={BG.border} strokeDasharray="3 3"/><XAxis dataKey="hour" tick={{fill:C.gray,fontSize:9}} interval={1}/><YAxis tick={{fill:C.gray,fontSize:10}}/><Tooltip content={<TT/>}/><Legend wrapperStyle={{fontSize:11,color:C.gray}}/>
                  <Bar dataKey="avgGT" name="Avg GT (min)" fill={C.blue} radius={[3,3,0,0]}/><Bar dataKey="avgDelay" name="Avg Delay (min)" fill={C.amber} radius={[3,3,0,0]}/><Bar dataKey="conflicts" name="Conflicts" fill={`${C.red}88`} radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            {cfg.extraRunway>0&&<Card>
              <div style={{fontSize:12,color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:14}}>Runway Throughput — {result.stats.totalRunways} Runways</div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={result.runwayThroughput} margin={{top:5,right:20,bottom:5,left:0}}>
                  <defs><linearGradient id="rtG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.blue} stopOpacity={0.35}/><stop offset="95%" stopColor={C.blue} stopOpacity={0.02}/></linearGradient></defs>
                  <CartesianGrid stroke={BG.border} strokeDasharray="3 3"/><XAxis dataKey="hour" tick={{fill:C.gray,fontSize:9}} interval={2}/><YAxis tick={{fill:C.gray,fontSize:10}}/><Tooltip content={<TT/>}/><Legend wrapperStyle={{fontSize:11,color:C.gray}}/>
                  <Area type="monotone" dataKey="demand" name="Demand" stroke={C.blue} fill="url(#rtG)" strokeWidth={2}/>
                  <Line type="monotone" dataKey="capacity" name="Cap limit" stroke={C.red} strokeWidth={1.5} dot={false} strokeDasharray="6 3"/>
                </AreaChart>
              </ResponsiveContainer>
              <div style={{marginTop:10,padding:"8px 12px",background:`${C.lime}11`,borderRadius:6,fontSize:12,color:C.lime}}>ROI: +{cfg.extraRunway*3650} slots/year × R$9,500 = R${(cfg.extraRunway*3650*9500/1e6).toFixed(0)}M revenue/year · Capex R${cfg.extraRunway===1?"1.2–1.8":"2.4–3.6"}B · Payback {cfg.extraRunway===1?"4.3":"7.1"} yrs</div>
            </Card>}
          </>)}

          {activeTab==="flightwise"&&<FlightImprovementTable simFlights={result.flights} flights={flights}/>}

          {activeTab==="issues"&&(<div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:12}}>
              {[{l:"Before",v:result.baseIssues.length,c:C.red},{l:"After",v:result.issues.length,c:result.issues.length<result.baseIssues.length?C.teal:C.amber},{l:"Resolved",v:result.stats.issuesResolved,c:C.teal},{l:"High-Sev Left",v:result.issues.filter(i=>i.severity==="high").length,c:result.issues.filter(i=>i.severity==="high").length>0?C.red:C.teal}].map(({l,v,c})=>(
                <div key={l} style={{background:BG.surface2,border:`1px solid ${BG.border}`,borderRadius:8,padding:"10px 14px"}}><div style={{fontSize:10,color:C.gray,fontFamily:"monospace",textTransform:"uppercase",marginBottom:6}}>{l}</div><div style={{fontSize:22,fontWeight:800,color:c}}>{v}</div></div>
              ))}
            </div>
            <IssuePanel issues={result.issues} flights={result.flights} title="Post-Simulation Issues + AI Fix Plans" accent={C.amber}/>
          </div>)}

          {activeTab==="resources"&&(<div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:14}}>
              {[{l:"Fuel Trucks",bl:6,sim:result.stats.fuelTrucks,c:C.amber,I:Truck,ct:result.stats.fuelContention},{l:"Ground Staff",bl:48,sim:result.stats.groundStaff,c:C.purple,I:Users,ct:result.stats.staffContention},{l:"Runways",bl:2,sim:result.stats.totalRunways,c:C.blue,I:Radio,ct:null}].map(({l,bl,sim,c,I,ct})=>(
                <Card key={l}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><I size={14} color={c}/><span style={{fontSize:11,color:C.gray,fontFamily:"monospace",textTransform:"uppercase"}}>{l}</span></div><div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:6}}><span style={{fontSize:24,fontWeight:800,color:c}}>{sim}</span>{sim>bl&&<span style={{fontSize:12,color:C.teal}}>+{sim-bl} added</span>}</div>{ct!==null&&<div style={{fontSize:12,color:ct>0?C.amber:C.teal}}>Contention: {ct}</div>}</Card>
              ))}
            </div>
            <Card style={{marginBottom:14}}>
              <div style={{fontSize:12,color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:14}}>Staff Utilisation by Hour</div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={result.staffUtil} margin={{top:5,right:20,bottom:5,left:0}}>
                  <defs><linearGradient id="su" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.purple} stopOpacity={0.4}/><stop offset="95%" stopColor={C.purple} stopOpacity={0.02}/></linearGradient></defs>
                  <CartesianGrid stroke={BG.border} strokeDasharray="3 3"/><XAxis dataKey="hour" tick={{fill:C.gray,fontSize:9}} interval={2}/><YAxis tick={{fill:C.gray,fontSize:10}}/><Tooltip content={<TT/>}/><Legend wrapperStyle={{fontSize:11,color:C.gray}}/>
                  <Area type="monotone" dataKey="used" name="Staff In Use" stroke={C.purple} fill="url(#su)" strokeWidth={2}/>
                  <Line type="monotone" dataKey="capacity" name="Max Capacity" stroke={C.red} strokeWidth={1.5} dot={false} strokeDasharray="6 3"/>
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </div>)}
        </>)}
      </div>
    </div>
  </div>);}

// ─── DASHBOARD, TURNAROUND, FORECASTING, ADVISOR ─────────────
// (kept intact from previous version — full implementations below)

function Dashboard({flights,baseline}){
  const onGround=flights.filter(f=>f.status==="on-ground");const arriving=flights.filter(f=>f.status==="arriving");const delayed=flights.filter(f=>f.delay>15);const avgGT=Math.round(flights.reduce((s,f)=>s+f.groundTime,0)/(flights.length||1));
  const fc=useMemo(()=>buildForecast(flights),[flights]);
  const gateHeat=useMemo(()=>GATES.map(gate=>{const cols=Array.from({length:19},(_,i)=>{const h=i+5;const occ=flights.filter(f=>f.gate===gate.id&&Math.floor(f.actualArr/60)<=h&&Math.floor(f.actualDep/60)>=h).length;return{color:occ===0?"#1F2937":occ===1?`${C.teal}55`:occ===2?`${C.amber}88`:`${C.red}99`};});return{gate:gate.id,terminal:gate.terminal,cols};}),[flights]);
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))",gap:12,marginBottom:20}}>
      <KPI label="Total Movements" value={flights.length} sub="Today" icon={Plane} color={C.amber}/><KPI label="On Ground" value={onGround.length} sub={`${arriving.length} arriving`} icon={Navigation} color={C.teal}/><KPI label="Avg Ground Time" value={`${avgGT}m`} sub={`Baseline: ${baseline.avgGT}m`} icon={Clock} color={C.blue} delta={Math.round((baseline.avgGT-avgGT)/baseline.avgGT*100)}/><KPI label="Delayed >15min" value={delayed.length} sub={`${Math.round(delayed.length/flights.length*100)}%`} icon={AlertTriangle} color={C.red}/><KPI label="Gate Util" value={`${baseline.utilization}%`} sub="Gate-hours" icon={Activity} color={C.purple}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16}}>
      <Card>
        <div style={{fontSize:12,color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:14,fontFamily:"monospace"}}>Hourly Traffic</div>
        <ResponsiveContainer width="100%" height={220}><AreaChart data={fc.hourly} margin={{top:5,right:10,bottom:5,left:0}}><defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.teal} stopOpacity={0.4}/><stop offset="95%" stopColor={C.teal} stopOpacity={0.02}/></linearGradient><linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.amber} stopOpacity={0.4}/><stop offset="95%" stopColor={C.amber} stopOpacity={0.02}/></linearGradient></defs><CartesianGrid stroke={BG.border} strokeDasharray="3 3"/><XAxis dataKey="hour" tick={{fill:C.gray,fontSize:10}} interval={2}/><YAxis tick={{fill:C.gray,fontSize:10}}/><Tooltip content={<TT/>}/><Legend wrapperStyle={{fontSize:11,color:C.gray}}/><Area type="monotone" dataKey="arrivals" stroke={C.teal} fill="url(#ag)" strokeWidth={2} name="Arrivals"/><Area type="monotone" dataKey="departures" stroke={C.amber} fill="url(#dg)" strokeWidth={2} name="Departures"/></AreaChart></ResponsiveContainer>
      </Card>
      <Card>
        <div style={{fontSize:12,color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:14,fontFamily:"monospace"}}>Carrier Split</div>
        <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={buildCarrierPerf(flights)} dataKey="flights" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>{buildCarrierPerf(flights).map((c,i)=><Cell key={i} fill={c.color}/>)}</Pie><Tooltip content={<TT/>}/></PieChart></ResponsiveContainer>
      </Card>
    </div>
    <Card style={{marginBottom:16}}>
      <div style={{fontSize:12,color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10,fontFamily:"monospace"}}>Gate Occupancy Heatmap 05:00→23:00</div>
      <div style={{fontSize:10,color:C.gray,fontFamily:"monospace",display:"flex",gap:20,marginBottom:8}}>{[["#1F2937","Free"],[`${C.teal}55`,"1 flt"],[`${C.amber}88`,"2 flt"],[`${C.red}99`,"Conflict"]].map(([bg,l])=><span key={l}><span style={{display:"inline-block",width:10,height:10,background:bg,border:`1px solid ${BG.border}`,marginRight:4}}/>{l}</span>)}</div>
      <div style={{overflowX:"auto"}}><table style={{borderCollapse:"collapse",fontSize:10,fontFamily:"monospace"}}><thead><tr><th style={{color:C.gray,padding:"2px 8px",textAlign:"left",minWidth:50}}>Gate</th>{Array.from({length:19},(_,i)=><th key={i} style={{color:C.gray,padding:"2px 4px",minWidth:28,textAlign:"center"}}>{s2(i+5)}</th>)}</tr></thead><tbody>{gateHeat.map(row=><tr key={row.gate}><td style={{color:"#9CA3AF",padding:"2px 8px",fontWeight:600}}>{row.gate}<span style={{color:C.gray,fontSize:9}}> {row.terminal}</span></td>{row.cols.map((col,ci)=><td key={ci} style={{background:col.color,width:26,height:18,border:`1px solid ${BG.page}`}}/>)}</tr>)}</tbody></table></div>
    </Card>
    <Card>
      <div style={{fontSize:12,color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:14,fontFamily:"monospace"}}>Live Flight Board</div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{borderBottom:`1px solid ${BG.border}`}}>{["Flight","AC","Gate","Origin","Dest","Arr","Dep","Delay","GT","Status"].map(h=><th key={h} style={{color:C.gray,padding:"6px 10px",textAlign:"left",fontSize:10,fontFamily:"monospace",letterSpacing:"0.08em",whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
        <tbody>{flights.slice(0,40).map((f,i)=><tr key={f.id} style={{borderBottom:`1px solid ${BG.surface2}`,background:i%2===0?"transparent":BG.surface2}}><td style={{padding:"7px 10px",color:f.airlineColor,fontWeight:700,fontFamily:"monospace"}}>{f.id}</td><td style={{padding:"7px 10px",color:"#9CA3AF",fontFamily:"monospace"}}>{f.acType}</td><td style={{padding:"7px 10px",color:"#F9FAFB",fontFamily:"monospace",fontWeight:600}}>{f.gate}</td><td style={{padding:"7px 10px",color:"#9CA3AF"}}>{f.origin}</td><td style={{padding:"7px 10px",color:"#9CA3AF"}}>{f.destination}</td><td style={{padding:"7px 10px",color:"#D1D5DB",fontFamily:"monospace"}}>{fmt(f.scheduledArr)}</td><td style={{padding:"7px 10px",color:"#D1D5DB",fontFamily:"monospace"}}>{fmt(f.actualDep)}</td><td style={{padding:"7px 10px",color:f.delay>15?C.red:f.delay>5?C.amber:C.teal,fontFamily:"monospace",fontWeight:600}}>{f.delay>0?`+${f.delay}m`:"—"}</td><td style={{padding:"7px 10px",color:"#9CA3AF",fontFamily:"monospace"}}>{f.groundTime}m</td><td style={{padding:"7px 10px"}}><StatusBadge status={f.status}/></td></tr>)}</tbody>
      </table></div>
    </Card>
  </div>);}

function TurnaroundOptimizer({flights}){
  const [selId,setSelId]=useState(flights.find(f=>f.status!=="departed")?.id||"");const [aiText,setAiText]=useState("");const [optimized,setOptimized]=useState(null);
  const flight=useMemo(()=>flights.find(f=>f.id===selId),[flights,selId]);
  const msList=[{key:"blockIn",label:"Block In",color:C.blue},{key:"doorsOpen",label:"Doors Open",color:C.teal},{key:"deplaning",label:"Deplaning ✓",color:C.teal},{key:"fuelStart",label:"Fuel Start",color:C.amber},{key:"cleaning",label:"Cleaning ✓",color:C.purple},{key:"catering",label:"Catering ✓",color:C.purple},{key:"fuelDone",label:"Fuel Done",color:C.amber},{key:"boardingStart",label:"Boarding ▶",color:C.teal},{key:"boardingDone",label:"Boarding ✓",color:C.teal},{key:"doorsClosed",label:"Doors Closed",color:C.blue},{key:"pushback",label:"Pushback",color:C.amber}];
  const ganttData=useMemo(()=>{if(!flight)return[];const ms=flight.milestones;return[{name:"Deboarding",start:ms.blockIn,end:ms.deplaning,color:`${C.teal}cc`},{name:"Cleaning",start:ms.deplaning,end:ms.cleaning,color:`${C.purple}cc`},{name:"Catering",start:ms.deplaning,end:ms.catering,color:`${C.purple}66`},{name:"Fuelling",start:ms.fuelStart,end:ms.fuelDone,color:`${C.amber}cc`},{name:"Boarding",start:ms.boardingStart,end:ms.boardingDone,color:`${C.blue}cc`}].map(p=>({...p,offset:p.start-ms.blockIn,duration:p.end-p.start}));},[flight]);
  const maxD=ganttData.reduce((s,p)=>Math.max(s,p.offset+p.duration),0)||1;
  const benchmark=AC_TYPES[flight?.acType]?.ground[0]||35;const overrun=flight?(flight.groundTime-benchmark):0;
  const PF_TURN={A320:`## Optimised Timeline\n- T+0: Block-in → fuel truck + cleaning deployed simultaneously\n- T+4: Doors open → deplaning\n- T+6: Fuel flow (safety zone allows parallel)\n- T+14: Deplaning done → catering starts in parallel with cleaning\n- T+22: Fuel + catering complete\n- T+24: Boarding (agents pre-staged from T+12)\n- T+33: Boarding done → T+37: Doors closed → T+40: Pushback\n\n## Savings\n- Parallel fuel+deplaning: −6 min\n- Pre-staged crew: −3 min\n- Dual-zone clean+cater: −4 min\n\n## Total: −7 min (47→40 min)`,B737:`## Optimised Timeline\n- T+0: Fuel truck right, bridge/stairs left\n- T+5: Doors open → deplaning\n- T+8: Single-point fuel (faster than A320)\n- T+16: Deplaning done → cleaning aft-to-fwd\n- T+24: Fuel + catering done\n- T+26: Boarding via both doors\n- T+38: Doors closed → T+42: Pushback\n\n## Savings\n- Bidirectional boarding: −5 min\n- Single-point refuelling exploited: −3 min\n\n## Total: −8 min (50→42 min)`,default:`## Optimised Protocol\n- T+0: Parallel deployment of all ground services\n- T+5: Doors open → deplaning + fuel simultaneously\n- T+18: Cleaning + catering in parallel\n- T+28: Boarding begins\n- T+42: Pushback\n\n## Total: −7 to −10 min`};
  const optimise=()=>{const key=flight?.acType||"default";setAiText(PF_TURN[key]||PF_TURN.default);const sv=Math.round((flight?.groundTime||45)*0.13);setOptimized({groundTime:(flight?.groundTime||45)-sv,saving:sv});};
  if(!flight)return <Card><div style={{color:C.gray}}>No flights available.</div></Card>;
  // Generate inline rec for this flight
  const flightRec=generateFlightRec(flight);
  return(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
    <div>
      <Card style={{marginBottom:12}}>
        <div style={{fontSize:12,color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:12}}>Select Flight</div>
        <select value={selId} onChange={e=>{setSelId(e.target.value);setAiText("");setOptimized(null);}} style={{width:"100%",background:BG.surface2,color:"#F9FAFB",border:`1px solid ${BG.border}`,borderRadius:6,padding:"8px 12px",fontSize:13,fontFamily:"monospace"}}>
          {flights.filter(f=>f.status!=="departed").slice(0,60).map(f=><option key={f.id} value={f.id}>{f.id} — {f.acType} — {f.origin}→{f.destination} — {fmt(f.scheduledArr)}</option>)}
        </select>
      </Card>
      <Card style={{marginBottom:12}}>
        {[["Flight",flight.id],["Aircraft",flight.acType],["Gate",flight.gate],["Pax",flight.pax],["Load Factor",`${flight.loadFactor}%`],["Scheduled Arr",fmt(flight.scheduledArr)],["Actual Arr",fmt(flight.actualArr)],["Ground Time",`${flight.groundTime} min`],["Benchmark",`${benchmark} min (${overrun>0?`+${overrun}m over`:"on target"})`],...(optimized?[["→ Optimised GT",`${optimized.groundTime} min (−${optimized.saving} min)`]]:[]),["Delay",flight.delay>0?`+${flight.delay} min`:"On time"]].map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:`1px solid ${BG.border}`,fontSize:13}}>
            <span style={{color:C.gray}}>{k}</span><span style={{color:k.startsWith("→")?C.teal:k==="Benchmark"&&overrun>0?C.amber:"#F9FAFB",fontFamily:"monospace",fontWeight:600}}>{v}</span>
          </div>
        ))}
        {/* Inline AI rec for this specific flight */}
        {flightRec?.actions?.length>0&&<div style={{marginTop:12,padding:"10px 12px",background:`${C.cyan}08`,border:`1px solid ${C.cyan}33`,borderRadius:6}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}><Lightbulb size={12} color={C.cyan}/><span style={{fontSize:10,color:C.cyan,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase"}}>AI Actions for This Flight</span></div>
          {flightRec.actions.map((a,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4,color:"#D1D5DB"}}><span>{a.label}</span><span style={{color:C.teal,fontWeight:700,fontFamily:"monospace"}}>−{a.saving} min</span></div>)}
          <div style={{fontSize:11,color:C.teal,fontWeight:700,marginTop:6,borderTop:`1px solid ${BG.border}`,paddingTop:6}}>Total potential: −{flightRec.totalPotential} min · R${flightRec.rValue.toLocaleString()}/rotation</div>
        </div>}
      </Card>
      <Card>{msList.map(ms=>(
        <div key={ms.key} style={{display:"flex",alignItems:"center",gap:10,padding:"5px 0",borderBottom:`1px solid ${BG.surface2}`}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:ms.color,flexShrink:0}}/>
          <span style={{flex:1,fontSize:12,color:"#9CA3AF"}}>{ms.label}</span>
          <span style={{fontSize:12,color:"#F9FAFB",fontFamily:"monospace",fontWeight:600}}>{fmt(flight.milestones[ms.key])}</span>
          <span style={{fontSize:11,color:C.gray,fontFamily:"monospace",minWidth:40,textAlign:"right"}}>+{flight.milestones[ms.key]-flight.milestones.blockIn}m</span>
        </div>
      ))}</Card>
    </div>
    <div>
      <Card style={{marginBottom:12}}>
        <div style={{fontSize:12,color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:14}}>Ground Phase Gantt</div>
        {ganttData.map((p,i)=>(
          <div key={i} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.gray,marginBottom:4}}><span>{p.name}</span><span style={{fontFamily:"monospace"}}>+{p.offset}m → +{p.offset+p.duration}m ({p.duration}m)</span></div>
            <div style={{background:BG.surface2,borderRadius:4,height:14,position:"relative"}}><div style={{position:"absolute",left:`${(p.offset/maxD)*100}%`,width:`${Math.max(2,(p.duration/maxD)*100)}%`,background:p.color,height:"100%",borderRadius:4}}/></div>
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.gray,fontFamily:"monospace",marginTop:6}}><span>0m</span><span>{Math.round(maxD/2)}m</span><span>{maxD}m</span></div>
      </Card>
      <Card style={{marginBottom:12}}>
        <button onClick={optimise} style={{width:"100%",background:`${C.teal}22`,color:C.teal,border:`1px solid ${C.teal}44`,borderRadius:8,padding:"11px",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><Zap size={14}/>Optimise This Turnaround</button>
        {optimized&&<div style={{marginTop:10,padding:"10px",background:`${C.teal}11`,borderRadius:8,border:`1px solid ${C.teal}33`}}><div style={{color:C.teal,fontWeight:700}}>−{optimized.saving} min saved</div><div style={{color:C.gray,fontSize:12}}>New GT: {optimized.groundTime} min</div></div>}
      </Card>
      <AiBlock text={aiText}/>
    </div>
  </div>);}

function Forecasting({flights}){
  const fc=useMemo(()=>buildForecast(flights),[flights]);const carriers=useMemo(()=>buildCarrierPerf(flights),[flights]);
  const [selC,setSelC]=useState(null);const [showF,setShowF]=useState(false);const [expAC,setExpAC]=useState(null);
  const selCarrier=carriers.find(c=>c.code===selC);
  const hourlyHL=useMemo(()=>fc.hourly.map(h=>{if(!selC)return h;const n=flights.filter(f=>f.airline===selC&&Math.floor(f.scheduledArr/60)===parseInt(h.hour)).length;return{...h,carrierArrivals:n};}),[fc.hourly,selC,flights]);
  const PS={poor:{A320:["Pre-positioned fuel trucks — saves 6 min/rotation","Dual-door catering+cleaning parallel protocol","Dedicated turnaround coordinator for consecutive rotations"],B737:["Single-point refuelling at T+8 (not T+15)","Bidirectional boarding: fwd bridge + aft stairs","42 min SLA — VCE alert if >45 min at T+20"],default:["Real-time milestone tracking via tablet","Pre-position equipment 20 min before block-in","Benchmark vs carrier's own best rotations"]},average:{default:["Review consecutive same-gate compression","Check catering supplier lead time","Gate reassignment to cut taxi-in 2–3 min"]}};
  const getSug=ac=>{if(!ac||ac.performance==="good")return[];const b=PS[ac.performance]||PS.average;return b[ac.type]||b.default;};
  // Carrier-specific rec generator
  const getCarrierRec=carrier=>{if(!carrier)return null;const worstAC=carrier.draggingDown[0];if(!worstAC)return null;const saving=Math.round(worstAC.overrun*0.55*worstAC.count);return{steps:[`Issue SOP bulletin to ${carrier.name} turnaround team: mandate parallel fuel+deplaning for all ${worstAC.type} rotations`,`Set ${worstAC.type} turnaround SLA at ${worstAC.benchmark+5} min — VCE alert triggers at T+${Math.round((worstAC.benchmark+5)*0.45)} if not on track`,`Assign dedicated coordinator for any ${carrier.name} ${worstAC.type} rotation with >3 consecutive same-gate blocks`,`Run 30-min joint training with ${carrier.name} ground handler on parallel service protocol`],rootCause:`${carrier.name} ${worstAC.type} averages ${worstAC.avgGT} min vs ${worstAC.benchmark} min benchmark. Primary driver: sequential deplaning+fuelling adds ${Math.round(worstAC.overrun*0.65)} min that parallel ops eliminate.`,saving:`−${Math.round(worstAC.overrun*0.55)} min × ${worstAC.count} daily ${worstAC.type} rotations = ${saving} min/day`,cost:"Zero — SOP change + training session",owner:`${carrier.name} Ops Manager + Ground Handler Team Lead`,kpi:`${carrier.name} ${worstAC.type} avg GT: target ${worstAC.benchmark+5} min (from ${worstAC.avgGT} min)`};};
  const [showCarrierRec,setShowCarrierRec]=useState(false);
  const PF_FORECAST=`## 30-Day Forecast\n- Week 1–2: Stable, −3% vs today (mid-week trough)\n- Week 3: +12% (pre-holiday surge)\n- Week 4: +19% peak — gate saturation T2 by 17:30\n- Weather: CBMSE cells peak Jan–Feb, 4–6 GDP events/month\n\n## Carrier Actions\n- GOL: mandate 45 min min GT for B737, add dedicated fuel truck\n- LATAM: turnaround coordinator for >3 same-gate consecutive rotations\n- Copa/American: pre-clearance cuts international dwell by 9 min avg\n\n## Capacity Ceiling\n- Current: 182 movements/day at 83% utilisation\n- Optimised: 204 movements/day (+12%)\n- Hard ceiling without new stands: 218/day`;
  return(<div>
    <Card style={{marginBottom:14}}>
      <div style={{fontSize:12,color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:14,fontFamily:"monospace"}}>30-Day Movement Trend</div>
      <ResponsiveContainer width="100%" height={180}><AreaChart data={fc.trend} margin={{top:5,right:20,bottom:5,left:0}}><defs><linearGradient id="movG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.amber} stopOpacity={0.4}/><stop offset="95%" stopColor={C.amber} stopOpacity={0.02}/></linearGradient></defs><CartesianGrid stroke={BG.border} strokeDasharray="3 3"/><XAxis dataKey="day" tick={{fill:C.gray,fontSize:9}} interval={4}/><YAxis tick={{fill:C.gray,fontSize:10}}/><Tooltip content={<TT/>}/><Area type="monotone" dataKey="movements" name="Movements" stroke={C.amber} fill="url(#movG)" strokeWidth={2}/><Line type="monotone" dataKey="delays" name="Avg Delay" stroke={C.red} strokeWidth={1.5} dot={false} strokeDasharray="4 2"/></AreaChart></ResponsiveContainer>
    </Card>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14}}>
      <Card>
        <div style={{fontSize:12,color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10,fontFamily:"monospace"}}>Avg Delay by Hour{selCarrier&&<span style={{color:selCarrier.color,fontSize:11,marginLeft:8}}>— {selCarrier.name}</span>}</div>
        <ResponsiveContainer width="100%" height={180}><BarChart data={hourlyHL} margin={{top:5,right:10,bottom:5,left:0}}><CartesianGrid stroke={BG.border} strokeDasharray="3 3"/><XAxis dataKey="hour" tick={{fill:C.gray,fontSize:9}} interval={2}/><YAxis tick={{fill:C.gray,fontSize:10}}/><Tooltip content={<TT/>}/><Bar dataKey="avgDelay" name="Avg Delay" radius={[3,3,0,0]}>{hourlyHL.map((h,i)=><Cell key={i} fill={selC&&h.carrierArrivals>0?selCarrier?.color:h.avgDelay>20?C.red:h.avgDelay>10?C.amber:C.teal} opacity={selC&&!h.carrierArrivals?0.25:1}/>)}</Bar>{selC&&<Bar dataKey="carrierArrivals" name={`${selCarrier?.name} arrivals`} fill={`${selCarrier?.color}55`} radius={[3,3,0,0]}/>}</BarChart></ResponsiveContainer>
      </Card>
      <Card>
        <div style={{fontSize:12,color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:10,fontFamily:"monospace"}}>Gate Occupancy Forecast</div>
        <ResponsiveContainer width="100%" height={180}><LineChart data={fc.hourly} margin={{top:5,right:10,bottom:5,left:0}}><CartesianGrid stroke={BG.border} strokeDasharray="3 3"/><XAxis dataKey="hour" tick={{fill:C.gray,fontSize:9}} interval={2}/><YAxis tick={{fill:C.gray,fontSize:10}} domain={[0,GATES.length]}/><Tooltip content={<TT/>}/><Line type="monotone" dataKey="occupancy" name="Gates in Use" stroke={C.blue} strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer>
      </Card>
    </div>
    <Card style={{marginBottom:14}}>
      <div style={{fontSize:12,color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:6,fontFamily:"monospace"}}>Carrier Performance — click row to drill down + see AI recommendations</div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr style={{borderBottom:`1px solid ${BG.border}`}}>{["Carrier","Flights","Avg GT","OTP","Load","Score","Status"].map(h=><th key={h} style={{color:C.gray,padding:"6px 12px",textAlign:"left",fontSize:10,fontFamily:"monospace"}}>{h}</th>)}</tr></thead>
        <tbody>{carriers.map((c,i)=>{const isSel=selC===c.code;return(<tr key={c.code} onClick={()=>{setSelC(isSel?null:c.code);setShowCarrierRec(false);}} style={{borderBottom:`1px solid ${BG.surface2}`,background:isSel?`${c.color}18`:i%2===0?"transparent":BG.surface2,cursor:"pointer",outline:isSel?`2px solid ${c.color}44`:"none"}}>
          <td style={{padding:"8px 12px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:4,height:24,borderRadius:2,background:c.color}}/><span style={{color:c.color,fontWeight:700}}>{c.name}</span></div></td>
          <td style={{padding:"8px 12px",color:"#9CA3AF",fontFamily:"monospace"}}>{c.flights}</td>
          <td style={{padding:"8px 12px",color:c.avgGT>48?C.red:c.avgGT>42?C.amber:C.teal,fontFamily:"monospace",fontWeight:600}}>{c.avgGT}m</td>
          <td style={{padding:"8px 12px"}}><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:50,background:BG.border,borderRadius:4,height:5}}><div style={{width:`${c.otp}%`,background:c.otp>85?C.teal:c.otp>75?C.amber:C.red,height:"100%",borderRadius:4}}/></div><span style={{fontSize:12,fontFamily:"monospace",color:"#F9FAFB"}}>{c.otp}%</span></div></td>
          <td style={{padding:"8px 12px",color:"#9CA3AF",fontFamily:"monospace"}}>{c.avgLoad}%</td>
          <td style={{padding:"8px 12px"}}><span style={{fontSize:13,fontWeight:800,color:c.score>75?C.teal:c.score>55?C.amber:C.red,fontFamily:"monospace"}}>{c.score}</span></td>
          <td style={{padding:"8px 12px"}}><span style={{fontSize:11,padding:"3px 8px",borderRadius:4,fontFamily:"monospace",fontWeight:700,background:c.otp>85?`${C.teal}22`:c.otp>75?`${C.amber}22`:`${C.red}22`,color:c.otp>85?C.teal:c.otp>75?C.amber:C.red}}>{c.otp>85?"Strong":c.otp>75?"Average":"At Risk"}</span></td>
        </tr>);})}
        </tbody>
      </table>
    </Card>
    {selCarrier&&<Card style={{marginBottom:14,border:`1px solid ${selCarrier.color}44`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{fontSize:15,fontWeight:800,color:selCarrier.color}}>{selCarrier.name} — Fleet Deep-Dive</div>
        <div style={{display:"flex",gap:8}}>
          {selCarrier.draggingDown.length>0&&<button onClick={()=>setShowCarrierRec(v=>!v)} style={{background:showCarrierRec?`${C.teal}22`:`${C.teal}11`,color:C.teal,border:`1px solid ${C.teal}44`,borderRadius:6,padding:"5px 12px",fontSize:11,cursor:"pointer",fontWeight:700,display:"flex",alignItems:"center",gap:5}}><Lightbulb size={11}/>{showCarrierRec?"Hide AI Fix":"AI Fix Plan"}</button>}
          <button onClick={()=>setSelC(null)} style={{background:"none",border:"none",color:C.gray,cursor:"pointer"}}><X size={16}/></button>
        </div>
      </div>
      {showCarrierRec&&<RecCard rec={getCarrierRec(selCarrier)} accent={C.teal}/>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14,marginTop:showCarrierRec?12:0}}>
        <div style={{background:`${C.red}11`,border:`1px solid ${C.red}33`,borderRadius:8,padding:"12px"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}><TrendingDown size={13} color={C.red}/><span style={{fontSize:11,color:C.red,fontWeight:700,textTransform:"uppercase",fontFamily:"monospace"}}>Dragging Down</span></div>
          {selCarrier.draggingDown.length===0?<div style={{color:C.gray,fontSize:12}}>No underperformers</div>:selCarrier.draggingDown.map(ac=>(
            <div key={ac.type} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",cursor:"pointer"}} onClick={()=>setExpAC(expAC===`${selC}-${ac.type}`?null:`${selC}-${ac.type}`)}>
                <span style={{fontSize:13,fontWeight:700,color:"#F9FAFB",fontFamily:"monospace"}}>{ac.type} ({ac.count})</span>
                <span style={{fontSize:12,color:C.red,fontFamily:"monospace"}}>+{ac.overrun}m over</span>
              </div>
              {expAC===`${selC}-${ac.type}`&&<div style={{marginTop:8,padding:"8px",background:`${C.amber}11`,borderRadius:6}}>
                {getSug(ac).map((s,i)=><div key={i} style={{fontSize:12,color:"#D1D5DB",display:"flex",gap:6,marginBottom:4}}><Zap size={11} color={C.amber} style={{flexShrink:0}}/>{s}</div>)}
                <div style={{marginTop:8,fontSize:10,color:C.gray,fontFamily:"monospace",textTransform:"uppercase",marginBottom:4}}>Worst rotations</div>
                {ac.flights.sort((a,b)=>b.groundTime-a.groundTime).slice(0,4).map(f=><div key={f.id} style={{display:"flex",justifyContent:"space-between",fontSize:11,fontFamily:"monospace",padding:"2px 0",borderBottom:`1px solid ${BG.border}`,color:"#9CA3AF"}}><span style={{color:selCarrier.color}}>{f.id}</span><span>{f.origin}→{f.destination}</span><span style={{color:C.red}}>{f.groundTime}m</span></div>)}
              </div>}
            </div>
          ))}
        </div>
        <div style={{background:`${C.teal}11`,border:`1px solid ${C.teal}33`,borderRadius:8,padding:"12px"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}><Star size={13} color={C.teal}/><span style={{fontSize:11,color:C.teal,fontWeight:700,textTransform:"uppercase",fontFamily:"monospace"}}>Lifting Performance</span></div>
          {selCarrier.lifting.length===0?<div style={{color:C.gray,fontSize:12}}>No standouts yet</div>:selCarrier.lifting.map(ac=>(
            <div key={ac.type} style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,fontWeight:700,color:"#F9FAFB",fontFamily:"monospace"}}>{ac.type} ({ac.count})</span><span style={{fontSize:12,color:C.teal,fontFamily:"monospace"}}>−{Math.abs(ac.overrun)}m</span></div>
              {ac.flights.sort((a,b)=>a.groundTime-b.groundTime).slice(0,3).map(f=><div key={f.id} style={{display:"flex",justifyContent:"space-between",fontSize:11,fontFamily:"monospace",padding:"2px 0",borderBottom:`1px solid ${BG.border}`,color:"#9CA3AF"}}><span style={{color:selCarrier.color}}>{f.id}</span><span>{f.origin}→{f.destination}</span><span style={{color:C.teal}}>{f.groundTime}m</span></div>)}
            </div>
          ))}
          {selCarrier.lifting.length>0&&<div style={{marginTop:8,fontSize:11,color:C.teal,padding:"6px 8px",background:`${C.teal}18`,borderRadius:5}}>📋 Use these rotations as internal SOP benchmark for other {selCarrier.name} types</div>}
        </div>
      </div>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{borderBottom:`1px solid ${BG.border}`}}>{["Flight","AC","Gate","Route","GT","Delay","Impact"].map(h=><th key={h} style={{color:C.gray,padding:"5px 10px",textAlign:"left",fontSize:10,fontFamily:"monospace"}}>{h}</th>)}</tr></thead>
        <tbody>{flights.filter(f=>f.airline===selCarrier.code).sort((a,b)=>b.groundTime-a.groundTime).map(f=>{const or=f.groundTime-(AC_TYPES[f.acType]?.ground[0]||30);return(<tr key={f.id} style={{borderBottom:`1px solid ${BG.surface2}`,background:or>12?`${C.red}11`:or>5?`${C.amber}09`:`${C.teal}08`}}>
          <td style={{padding:"6px 10px",color:selCarrier.color,fontWeight:700,fontFamily:"monospace"}}>{f.id}</td><td style={{padding:"6px 10px",color:"#9CA3AF",fontFamily:"monospace"}}>{f.acType}</td><td style={{padding:"6px 10px",color:"#F9FAFB",fontFamily:"monospace"}}>{f.gate}</td><td style={{padding:"6px 10px",color:"#9CA3AF"}}>{f.origin}→{f.destination}</td><td style={{padding:"6px 10px",fontWeight:700,fontFamily:"monospace",color:or>12?C.red:or>5?C.amber:C.teal}}>{f.groundTime}m</td><td style={{padding:"6px 10px",color:f.delay>15?C.red:f.delay>5?C.amber:C.teal,fontFamily:"monospace"}}>{f.delay>0?`+${f.delay}m`:"—"}</td>
          <td style={{padding:"6px 10px"}}>{or>12?<span style={{color:C.red,fontSize:11,display:"flex",alignItems:"center",gap:2}}><ArrowDown size={11}/>−{or}m</span>:<span style={{color:C.teal,fontSize:11,display:"flex",alignItems:"center",gap:2}}><ArrowUp size={11}/>+{Math.abs(or)}m</span>}</td>
        </tr>);})}
        </tbody>
      </table></div>
    </Card>}
    <Card>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:12,color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace"}}>VCE 30-Day Forecast</div>
        <button onClick={()=>setShowF(v=>!v)} style={{background:`${C.blue}22`,color:C.blue,border:`1px solid ${C.blue}44`,borderRadius:6,padding:"6px 14px",fontSize:12,cursor:"pointer",fontWeight:600}}>{showF?"Hide":"View Forecast"}</button>
      </div>
      {showF&&<AiBlock text={PF_FORECAST}/>}
    </Card>
  </div>);}

function AIAdvisor({flights,baseline}){
  const PF_RECS=[
    {rank:1,title:"Pre-position fuel trucks 20 min before block-in for LATAM A320 rotations",category:"Turnaround",impact:"High",effort:"Low",expectedSaving:"7 min/rotation",confidence:89,financial:"R$1.8M/yr",shap:[{factor:"Fuel truck idle wait",contribution:0.52},{factor:"LATAM A320 frequency",contribution:0.31},{factor:"Apron crew shift overlap",contribution:0.17}],detail:"## Implementation\n**Who:** Apron Ops + LATAM Ground Handler (Swissport)\n**When:** T−25 min before predicted block-in\n**How:**\n- VCE sends push alert to fuel dispatcher at T−25 min\n- Truck routed to assigned gate, arrives T−5 min\n- Fuel flow starts within 90 sec of aircraft door opening\n\n## R$ Impact\n7 min × 6 daily A320 rotations × R$9,500/slot × 365 = R$1.83M/year\n\n## KPIs\n- Fuel-start to block-in: target <8 min (from 15 min)\n- Pre-positioning compliance: >90%\n- LATAM OTP: +4 pp target"},
    {rank:2,title:"Gate freeze protocol 55 min before morning and evening peak banks",category:"Gate",impact:"High",effort:"Low",expectedSaving:"12 min system-wide",confidence:84,financial:"R$2.4M/yr",shap:[{factor:"Last-minute gate reassignments",contribution:0.48},{factor:"Morning bank density 07–09",contribution:0.35},{factor:"Handler repositioning lag",contribution:0.17}],detail:"## Implementation\n**Who:** AOC shift supervisor\n**When:** 07:30–09:00 and 17:30–19:30 daily\n**How:**\n- AOC issues Gate Freeze Notice T−55 min via ACARS/SITA\n- No reassignments inside freeze window except safety-critical\n- Handler crews pre-positioned at T−30 min\n\n## R$ Impact\n12 min × 180 movements × 65% affected × R$150/min = R$2.4M/year\n\n## KPIs\n- Reassignment events inside freeze: <2/day (from 18)\n- On-time pushback during peaks: 78% target (from 61%)"},
    {rank:3,title:"EOBT-based departure sequence issued 45 min before each pushback bank",category:"Flow",impact:"High",effort:"Medium",expectedSaving:"3.8 min avg taxi-out",confidence:79,financial:"R$1.1M/yr",shap:[{factor:"Taxi queue depth at peak",contribution:0.44},{factor:"EOBT accuracy improvement",contribution:0.36},{factor:"Runway coordination lag",contribution:0.20}],detail:"## Implementation\n**Who:** Apron Control + DECEA Tower\n**When:** Each departure bank (07:45, 10:30, 13:15, 16:00, 18:30, 20:00)\n**How:**\n- VCE generates EOBT-ordered sequence 45 min before bank\n- Pushback clearances in sequence order\n- 4-slot buffer for late EOBT updates\n\n## R$ Impact\n3.8 min × 140 daily departures × R$150/min = R$1.1M/year\n\n## KPIs\n- Avg taxi-out: 9.2 min (from 13 min)\n- EOBT accuracy ±3 min: 74% of departures"},
    {rank:4,title:"Redirect GOL B737 overflow to T3 remote stands during 07–09 congestion",category:"Capacity",impact:"Medium",effort:"Low",expectedSaving:"6 min avg taxi",confidence:74,financial:"R$640K/yr",shap:[{factor:"GOL peak concentration T2",contribution:0.45},{factor:"T3 remote availability",contribution:0.33},{factor:"Taxi route efficiency R3-R4",contribution:0.22}],detail:"## Implementation\n**Who:** GOL Ground Operations + Slot Coordinator\n**When:** 06:30–09:30 when T2 occupancy >80%\n**How:**\n- VCE triggers T3 overflow advisory at T−60 min\n- GOL ops reassigns next 2–3 B737s to R3, R4\n- Passenger buses pre-staged\n\n## R$ Impact\n2 gates freed × 2 daily peaks × 180 days = R$640K/year"},
    {rank:5,title:"Trigger GDP advisory for 18:00 bank — issue airborne holding alert now",category:"Delay",impact:"High",effort:"Medium",expectedSaving:"22 min downstream cascade",confidence:71,financial:"R$1.4M/yr",shap:[{factor:"18:00 arrival saturation",contribution:0.55},{factor:"Taxi-out queue depth",contribution:0.27},{factor:"Weather cell risk 17:30",contribution:0.18}],detail:"## Implementation\n**Who:** AOC Duty Manager + DECEA GDP Coordinator\n**When:** T−90 min if >38 arrivals forecast in 18:00 bank\n**How:**\n- VCE generates GDP recommendation with confidence score\n- AOC Duty Manager approves\n- GDP advisory via AFTN to all carriers\n\n## R$ Impact\n22 min × 45 flights × R$150/min = R$1.4M/year"},
    {rank:6,title:"Parallelise catering + cleaning on A319/E195 — dual-door access protocol",category:"Turnaround",impact:"Medium",effort:"Medium",expectedSaving:"4 min/rotation",confidence:68,financial:"R$520K/yr",shap:[{factor:"Sequential catering+cleaning",contribution:0.50},{factor:"Single-door access default",contribution:0.32},{factor:"Crew coordination lag",contribution:0.18}],detail:"## Implementation\n**Who:** Ground handler catering + cleaning team leads\n**When:** All A319/E195 rotations with GT <40 min\n**How:**\n- Catering crew uses door 1L from T+6 min\n- Cleaning crew enters door 2R simultaneously\n- Both exit at T+18 min\n\n## R$ Impact\n4 min × 28 daily rotations × R$150/min = R$520K/year"},
  ];
  const PF_FREEFORM={delay18:"## Root Cause — 18:00 Delay Cascade\n\n**Step 1 — Upstream Input Delay (T−90 min)**\nFlights from CGH/SDU arrive 12–18 min late due to SP metro ATC congestion.\n\n**Step 2 — Compressed Ground Time**\nCrew attempts 47-min turnaround in 29 min. 73% of 18:00 departures push back 8–22 min late.\n\n**Step 3 — Taxi Queue Saturation**\n22+ aircraft request pushback in 35 min. Alpha intersection queue backs to 8 aircraft. Taxi-out extends 9→17 min.\n\n**Step 4 — Runway Throughput Drop**\n09L accepts 28 mov/hr VMC. Saturation drops effective rate to 21. 31-min cascade into 20:00 bank.\n\n**Fix:** GDP advisory at 16:30. Absorb 15 min en-route. Arrival rate 42→34/hr. Cascade <8 min.",default:"## VCE Analysis\n\n**Current State:**\n- 182 movements, 28% with delays >5 min\n- Peak pressure: 07:30–09:00 and 17:30–19:30\n- Gate utilisation: 83% — approaching 87% saturation threshold\n- Avg GT: 47 min vs 42 min IATA benchmark\n\n**Priority Interventions:**\n1. Gate optimisation → immediate −6 min ground time\n2. Pre-position ground crews via VCE predictive triggers\n3. GDP advisory for evening peak if >38 arrivals forecast\n\n**Commercial Context:**\n- Every 1 min recovered = R$27,000/day\n- Current efficiency gap: R$135,000/day\n- Full stack potential: R$11.2M annual"};
  const [activeRec,setActiveRec]=useState(null);const [freeformQ,setFreeformQ]=useState("");const [freeformA,setFreeformA]=useState("");
  const delayed=flights.filter(f=>f.delay>15);const getAns=q=>{if(q.toLowerCase().includes("18")&&(q.toLowerCase().includes("delay")||q.toLowerCase().includes("cascade")))return PF_FREEFORM.delay18;return PF_FREEFORM.default;};
  const impC={High:C.red,Medium:C.amber,Low:C.teal};const effC={Low:C.teal,Medium:C.amber,High:C.red};
  return(<div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
      <KPI label="Delay Risk" value={delayed.length>30?"HIGH":delayed.length>15?"MED":"LOW"} sub={`${delayed.length} delayed`} icon={Shield} color={delayed.length>30?C.red:delayed.length>15?C.amber:C.teal}/>
      <KPI label="Gate Pressure" value={`${Math.min(99,Math.round(baseline.utilization+10))}%`} sub="Utilisation" icon={Activity} color={C.amber}/>
      <KPI label="Conflicts" value={baseline.conflicts} sub="Gate conflicts" icon={AlertTriangle} color={baseline.conflicts>10?C.red:C.amber}/>
      <KPI label="VCE Confidence" value="84%" sub="7-day accuracy" icon={Cpu} color={C.purple}/>
    </div>
    <Card style={{marginBottom:14}}>
      <div style={{marginBottom:14}}><div style={{fontSize:13,color:"#F9FAFB",fontWeight:700}}>Priority Action Queue</div><div style={{fontSize:12,color:C.gray,marginTop:2}}>Click any rec to expand full implementation plan</div></div>
      {PF_RECS.map((rec,i)=>{const isA=activeRec===i;return(
        <div key={i} style={{marginBottom:10,border:`1px solid ${isA?C.amber:BG.border}`,borderRadius:8,background:isA?`${C.amber}08`:BG.surface2,overflow:"hidden"}}>
          <div style={{padding:"12px 16px",cursor:"pointer"}} onClick={()=>setActiveRec(isA?null:i)}>
            <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
              <div style={{background:C.amber,color:"#000",borderRadius:6,width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:12,flexShrink:0}}>{rec.rank}</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <div style={{fontSize:13,color:"#F9FAFB",fontWeight:600,flex:1,paddingRight:12}}>{rec.title}</div>
                  <div style={{display:"flex",gap:5}}><span style={{fontSize:10,padding:"2px 7px",borderRadius:4,fontFamily:"monospace",fontWeight:700,background:`${impC[rec.impact]}22`,color:impC[rec.impact]}}>{rec.impact}</span><span style={{fontSize:10,padding:"2px 7px",borderRadius:4,fontFamily:"monospace",fontWeight:700,background:`${effC[rec.effort]}22`,color:effC[rec.effort]}}>Effort:{rec.effort}</span></div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
                  <span style={{fontSize:12,color:C.teal,fontWeight:700}}>✓ {rec.expectedSaving}</span>
                  {rec.financial&&<span style={{fontSize:12,color:C.amber,fontWeight:700}}>{rec.financial}</span>}
                  <span style={{fontSize:11,color:C.gray}}>Confidence: {rec.confidence}%</span>
                </div>
                {rec.shap&&<div style={{marginTop:8,display:"flex",gap:8}}>{rec.shap.map((s,si)=><div key={si} style={{flex:1,fontSize:10,color:C.gray}}><div style={{marginBottom:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.factor}</div><div style={{background:BG.border,borderRadius:3,height:4}}><div style={{width:`${Math.round(s.contribution*100)}%`,background:si===0?C.amber:si===1?C.blue:C.purple,height:"100%",borderRadius:3}}/></div></div>)}</div>}
              </div>
              <ChevronRight size={14} color={C.gray} style={{flexShrink:0,transform:isA?"rotate(90deg)":"none",transition:"transform 0.2s"}}/>
            </div>
          </div>
          {isA&&<div style={{borderTop:`1px solid ${BG.border}`,padding:"12px 16px"}}><AiBlock text={rec.detail}/></div>}
        </div>);})}
    </Card>
    <Card>
      <div style={{fontSize:12,color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:12}}>Ask VCE</div>
      <textarea value={freeformQ} onChange={e=>setFreeformQ(e.target.value)} rows={3} placeholder="e.g. 'What is causing the 18:00 delay cascade?' or 'Which carrier needs immediate intervention?'" style={{width:"100%",background:BG.surface2,color:"#F9FAFB",border:`1px solid ${BG.border}`,borderRadius:8,padding:"10px 14px",fontSize:13,resize:"vertical",fontFamily:"monospace",boxSizing:"border-box"}}/>
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:8}}><button onClick={()=>{if(freeformQ.trim())setFreeformA(getAns(freeformQ));}} style={{background:C.amber,color:"#000",border:"none",borderRadius:8,padding:"9px 20px",fontWeight:800,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:8}}><Terminal size={13}/>Analyse</button></div>
      {freeformA&&<AiBlock text={freeformA}/>}
    </Card>
  </div>);}

// ─── ROOT APP ────────────────────────────────────────────────
const TABS=[{id:"dashboard",label:"Dashboard",icon:BarChart2},{id:"scenario",label:"Simulator",icon:GitBranch},{id:"turnaround",label:"Turnaround",icon:RefreshCw},{id:"forecast",label:"Forecasting",icon:TrendingUp},{id:"advisor",label:"AI Advisor",icon:Cpu}];

export default function App(){
  const [tab,setTab]=useState("dashboard");const [now,setNow]=useState(new Date());
  const baseline=useMemo(()=>runAdvancedDES(FLIGHTS,{}).stats,[]);
  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),30000);return()=>clearInterval(t);},[]);
  return(<div style={{background:BG.page,minHeight:"100vh",fontFamily:"'Inter',system-ui,sans-serif",color:"#F9FAFB"}}>
    <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}*{box-sizing:border-box}input,select,textarea{outline:none}button{outline:none}`}</style>
    <div style={{background:BG.surface,borderBottom:`1px solid ${BG.border}`,padding:"0 24px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",maxWidth:1400,margin:"0 auto",height:56}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{background:C.amber,borderRadius:8,width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center"}}><Plane size={18} color="#000"/></div>
          <div><div style={{fontSize:15,fontWeight:800}}>VCE <span style={{color:C.amber}}>Virtual Capacity Engine</span></div><div style={{fontSize:10,color:C.gray,fontFamily:"monospace",letterSpacing:"0.1em"}}>GRU · SBGR · GUARULHOS · ops@vce.aero</div></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{fontSize:12,color:C.gray,fontFamily:"monospace"}}><span style={{color:C.teal}}>●</span> {FLIGHTS.length} movements · {now.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</div>
        </div>
      </div>
      <div style={{display:"flex",gap:2,maxWidth:1400,margin:"0 auto",overflowX:"auto"}}>
        {TABS.map(t=>{const Icon=t.icon;const a=t.id===tab;return(<button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",borderBottom:`2px solid ${a?C.amber:"transparent"}`,color:a?"#F9FAFB":C.gray,padding:"10px 18px",fontSize:13,fontWeight:a?700:400,cursor:"pointer",display:"flex",alignItems:"center",gap:7,whiteSpace:"nowrap",flexShrink:0}}><Icon size={14}/>{t.label}</button>);})}
      </div>
    </div>
    <div style={{maxWidth:1400,margin:"0 auto",padding:"20px 24px"}}>
      {tab==="dashboard"  &&<Dashboard flights={FLIGHTS} baseline={baseline}/>}
      {tab==="scenario"   &&<ScenarioSimulator flights={FLIGHTS} baseline={baseline}/>}
      {tab==="turnaround" &&<TurnaroundOptimizer flights={FLIGHTS}/>}
      {tab==="forecast"   &&<Forecasting flights={FLIGHTS}/>}
      {tab==="advisor"    &&<AIAdvisor flights={FLIGHTS} baseline={baseline}/>}
    </div>
  </div>);}
