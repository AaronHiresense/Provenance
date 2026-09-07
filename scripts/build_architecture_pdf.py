# -*- coding: utf-8 -*-
"""One-page architecture note for PROVENANCE, in the deck's palette."""
import os
from reportlab.lib import colors
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Flowable, Frame, KeepTogether,
                                PageTemplate, Paragraph, Spacer, Table,
                                TableStyle)

OUT = r"D:\Work_Folders\Provenance\docs\architecture-note.pdf"

NAVY = colors.HexColor("#000048")
BLUE = colors.HexColor("#0000CC")
INK = colors.HexColor("#27303F")
MUTED = colors.HexColor("#6B7280")
TINT = colors.HexColor("#EFF3FF")
RULE = colors.HexColor("#C9D3F2")

for name, fn in [("Cal", "calibri.ttf"), ("Cal-B", "calibrib.ttf"),
                 ("Cal-I", "calibrii.ttf"), ("Cal-BI", "calibriz.ttf")]:
    pdfmetrics.registerFont(TTFont(name, os.path.join(r"C:\Windows\Fonts", fn)))
pdfmetrics.registerFontFamily("Cal", normal="Cal", bold="Cal-B",
                              italic="Cal-I", boldItalic="Cal-BI")

MARGIN = 13 * mm
PW, PH = A4
CW = PW - 2 * MARGIN


SCALE = float(os.environ.get("ARCH_SCALE", "1.0"))


def st(name, size, leading, color=INK, font="Cal", space=0, align=None):
    kw = dict(name=name, fontName=font, fontSize=size * SCALE,
              leading=leading * SCALE,
              textColor=color, spaceAfter=space)
    if align:
        kw["alignment"] = align
    return ParagraphStyle(**kw)


S_TITLE = st("t", 19, 21, NAVY, "Cal-B")
S_SUB = st("s", 8.4, 10.4, BLUE, "Cal-B")
S_LEAD = st("l", 8.6, 11.4, INK, space=0)
S_H = st("h", 10.5, 12.5, NAVY, "Cal-B")
S_BODY = st("b", 8.4, 10.4, INK)
S_CELL = st("c", 7.8, 9.5, INK)
S_CELLB = st("cb", 7.8, 9.5, NAVY, "Cal-B")
S_HEADCELL = st("hc", 7.1, 8.7, BLUE, "Cal-B")
S_NOTE = st("n", 8.0, 9.8, INK)
S_FOOT = st("f", 7.4, 9.0, MUTED)
S_IO = st("io", 7.4, 9.2, INK)


class Rule(Flowable):
    def __init__(self, w, color=RULE, thick=0.6):
        self.width, self.color, self.thick = w, color, thick
        self.height = thick

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thick)
        self.canv.line(0, 0, self.width, 0)


class FlowStrip(Flowable):
    """The 5-stage pipeline as rounded boxes with arrows, plus the registry."""
    STAGES = [("1", "EXTRACT", "LLM"), ("2", "VALIDATE", "pure code"),
              ("3", "LEDGER", "data"), ("4", "REASON", "LLM"),
              ("5", "VERDICT", "pure code")]

    def __init__(self, width):
        self.width = width
        self.height = 45

    def draw(self):
        c = self.canv
        n = len(self.STAGES)
        gap, bh = 13.0, 26.0
        bw = (self.width - (n - 1) * gap) / n
        y = self.height - bh
        for i, (num, name, kind) in enumerate(self.STAGES):
            x = i * (bw + gap)
            c.setFillColor(TINT)
            c.setStrokeColor(BLUE)
            c.setLineWidth(0.6)
            c.roundRect(x, y, bw, bh, 3, stroke=1, fill=1)
            c.setFillColor(NAVY)
            c.setFont("Cal-B", 8.6)
            c.drawCentredString(x + bw / 2, y + bh - 11.5, "%s · %s" % (num, name))
            c.setFillColor(MUTED)
            c.setFont("Cal", 6.7)
            c.drawCentredString(x + bw / 2, y + 5.5, kind.upper())
            if i < n - 1:
                ax, ay = x + bw + 2.5, y + bh / 2
                c.setStrokeColor(BLUE)
                c.setLineWidth(0.9)
                c.line(ax, ay, ax + gap - 7.5, ay)
                c.setFillColor(BLUE)
                p = c.beginPath()
                p.moveTo(ax + gap - 5, ay)
                p.lineTo(ax + gap - 9, ay + 2.4)
                p.lineTo(ax + gap - 9, ay - 2.4)
                p.close()
                c.drawPath(p, fill=1, stroke=0)
        x2 = 1 * (bw + gap)
        c.setStrokeColor(BLUE)
        c.setLineWidth(0.5)
        c.setDash(1.6, 1.6)
        c.line(x2 + bw / 2, y - 1, x2 + bw / 2, y - 6)
        c.setDash()
        c.setFillColor(MUTED)
        c.setFont("Cal-I", 6.8)
        c.drawCentredString(x2 + bw / 2, y - 14,
                            "MCA registry · 3.67M companies · DuckDB, local file")


def cell(text, style=S_CELL):
    return Paragraph(text, style)


def make_table(rows, widths, header=True):
    data = []
    for i, r in enumerate(rows):
        style = S_HEADCELL if (header and i == 0) else None
        data.append([cell(t, style or (S_CELLB if j == 0 and i else S_CELL))
                     for j, t in enumerate(r)])
    t = Table(data, colWidths=widths, hAlign="LEFT")
    cmds = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 2.6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2.6),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, RULE),
    ]
    if header:
        cmds += [("BACKGROUND", (0, 0), (-1, 0), TINT),
                 ("LINEBELOW", (0, 0), (-1, 0), 0.5, RULE)]
    t.setStyle(TableStyle(cmds))
    return t


def callout(text):
    t = Table([[Paragraph(text, S_NOTE)]], colWidths=[CW], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), TINT),
        ("BOX", (0, 0), (-1, -1), 0.6, BLUE),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def heading(n, text):
    t = Table([[Paragraph("%s" % n, ParagraphStyle(
        "num", fontName="Cal-B", fontSize=10, leading=12,
        textColor=colors.white)),
        Paragraph(text, S_H)]], colWidths=[13, CW - 13], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), BLUE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (0, 0), "CENTER"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("RIGHTPADDING", (0, 0), (0, 0), 0),
        ("LEFTPADDING", (1, 0), (1, 0), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 1.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1.5),
    ]))
    return t


story = []
story.append(Paragraph("PROVENANCE \u2014 architecture note", S_TITLE))
story.append(Spacer(1, 2))
story.append(Paragraph(
    "Quessathon 2026 \u00b7 Challenge 07 \u2014 Counterfeit Parts Verification "
    "\u00b7 Team Mavericks", S_SUB))
story.append(Spacer(1, 5))
story.append(Rule(CW, BLUE, 1.1))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "An agent that reads a part\u2019s paper trail and decides, against records we do "
    "not control, whether the part is what its paperwork claims. Exactly one verdict "
    "\u2014 <b>GENUINE \u00b7 SUSPECT \u00b7 UNVERIFIABLE</b> \u2014 produced fully "
    "offline. We did not build a scenario catalogue; we built a <b>contradiction "
    "engine</b>: claims are routed to checks by their <i>type</i>, never by anticipated "
    "scenario, so an unseen case is a new combination of claims, not a missing branch.",
    S_LEAD))
story.append(Spacer(1, 8))

story.append(heading("1", "System flow"))
story.append(Spacer(1, 4))
story.append(Paragraph(
    "<b>IN</b> one dossier — certificate of conformity · tax invoice "
    "· dispatch note · e-way bill · bill of entry, as pasted text, "
    "dropped files or JSON", S_IO))
story.append(Spacer(1, 3))
story.append(FlowStrip(CW))
story.append(Spacer(1, 3))
story.append(Paragraph(
    "<b>OUT</b> exactly one verdict — GENUINE · SUSPECT · "
    "UNVERIFIABLE (missing | inaccessible | contradictory | insufficient) — with "
    "the evidence ledger, the declared limits, and the next move for the desk", S_IO))
story.append(Spacer(1, 6))
story.append(make_table([
    ["STAGE", "KIND", "WHAT IT DOES"],
    ["1 extract.py", "LLM",
     "Documents become typed assertions {entity, attribute, value, source_doc, date}. "
     "Document text is <b>data, never instructions</b>: instruction-like lines are "
     "stripped before the model sees them and logged as evidence of tampering."],
    ["2 validators.py", "pure code",
     "25 deterministic checks against the local MCA registry: GSTIN checksum / state / "
     "embedded PAN, CIN decode and registry cross-check, temporal sanity, e-way-bill "
     "validity vs distance, HSN vs part, port and mode of entry, BIS, TAC, lot-code "
     "grammar, cross-document drift, dossier reuse, and a successor lookup that "
     "goes hunting for a company no document names."],
    ["3 ledger.py", "data",
     "Every finding carries <b>direction</b> (genuine / suspect / neutral), "
     "<b>strength</b> (weak \u2192 dispositive), <b>source tier</b> (authoritative \u2192 "
     "derived \u2192 self-reported \u2192 heuristic) and <b>dimension</b> (identity, "
     "certification, provenance, custody)."],
    ["4 reason.py", "LLM",
     "One benign and one malicious explanation per contradiction, adjudicated under "
     "fixed tier rules — then a second pass in which the agent attacks its own "
     "draft and may revise it. Switchable off live (rules-only mode)."],
    ["5 verdict.py", "pure code",
     "One verdict and subtype, the work order, the action for each desk, and the "
     "case-aware limits."],
], [64, 42, CW - 106]))
story.append(Spacer(1, 5))
story.append(callout(
    "<b>Governance floors live in code, not in the prompt.</b> Authoritative evidence "
    "beats any number of heuristics \u00b7 tiers are never averaged \u00b7 heuristics "
    "alone can never force SUSPECT \u00b7 an absent registry record is a gap, not proof "
    "\u00b7 identity evidence alone never certifies goods. No blended score is ever "
    "emitted. The self-critique may move a verdict only toward caution, and only "
    "when a non-heuristic contradiction exists — doubt manufactured from nothing "
    "is an abstention rate, not judgement. A malformed model answer falls back to the "
    "deterministic reasoner instead of reaching the verdict stage."))
story.append(Spacer(1, 9))

story.append(heading("2", "Dependencies"))
story.append(Spacer(1, 4))
story.append(make_table([
    ["DEPENDENCY", "WHAT IT IS", "IF UNAVAILABLE"],
    ["MCA registry",
     "3.67M companies (data.gov.in Company Master Data, snapshot 2026-07-22) indexed "
     "in a local DuckDB file, mounted from a volume in deployment",
     "The service still boots and reports the gap; dependent checks <b>abstain</b> and "
     "the verdict degrades to UNVERIFIABLE \u2014 never to a guess."],
    ["LLM (stages 1, 4)",
     "Any Anthropic- or OpenAI-compatible endpoint behind one thin wrapper "
     "(demo: DeepSeek-chat, temperature 0)",
     "<b>Optional.</b> With no key a deterministic parser and template reasoner take "
     "over; every result labels which engine ran."],
    ["Runtime",
     "Python 3.12+, FastAPI, uvicorn, duckdb \u2014 the whole of requirements.txt",
     "Required. No queue, no second database, no external service."],
    ["Frontend",
     "React + Vite + TypeScript + Tailwind",
     "<b>Build-time only.</b> The compiled bundle is committed, so a clone runs on "
     "Python alone."],
    ["BIS / GSTN portals",
     "Deliberately <i>not</i> dependencies \u2014 both are captcha-gated",
     "Modelled as a declared local stub and surfaced as the "
     "UNVERIFIABLE (inaccessible) subtype rather than silently skipped."],
    ["Seen-lots archive",
     "An append-only local file of dossier fingerprints: the desk memory, and the "
     "only thing in the system that can see a <i>reused</i> dossier",
     "Degrades to no finding at all on a read-only disk. Never consulted by a "
     "calibration run, so the offline eval stays deterministic."],
    ["Network",
     "None in the core path \u2014 no CDN, no web fonts, no live lookups",
     "Pipeline, UI, tests and calibration all run with the cable pulled."],
], [72, CW * 0.36, CW - 72 - CW * 0.36]))
story.append(Spacer(1, 9))

story.append(heading("3", "Human hand-off points"))
story.append(Spacer(1, 4))
handoffs = [
    ("Briefing \u2014 the human decides what the agent sees.",
     "Pasted paperwork, dropped files, a dossier JSON, or a bare CIN / GSTIN: nothing "
     "is auto-ingested. Before the run, <i>preflight</i> reports what the agent can "
     "see, the registry row it found, the checks it will run, and which document "
     "would unlock more."),
    ("Ablation \u2014 the human can amputate the model.",
     "The reviewer switches stage 4 off and re-runs the same dossier; the difference "
     "between the two answers is the model\u2019s contribution, shown rather than claimed."),
    ("The verdict is a recommendation, never an action.",
     "The system never releases, quarantines, pays or emails. It issues the move for "
     "each desk \u2014 OEM brand protection, distributor incoming-goods QA (the primary "
     "user), showroom and service \u2014 and a person executes it."),
    ("The abstention work order \u2014 the human sends it.",
     "UNVERIFIABLE names its subtype, the single decisive missing artefact, an interim "
     "action and a low-confidence lean, then <b>drafts</b> the supplier request for a "
     "person to send. The lot waits on screen until it arrives. Nothing leaves the "
     "machine."),
    ("Declared limits \u2014 the human is told what was not checked.",
     "Every verdict ships a case-aware \u201cwhat this system cannot determine\u201d block: "
     "the physical part, image forensics, a byte-perfect cloned dossier, events after "
     "the registry snapshot, and intent."),
]
rows = []
for i, (h, b) in enumerate(handoffs, 1):
    rows.append([Paragraph("%d" % i, ParagraphStyle(
        "hn", fontName="Cal-B", fontSize=8.0, leading=9.6, textColor=BLUE)),
        Paragraph("<b>%s</b> %s" % (h, b), S_BODY)])
t = Table(rows, colWidths=[11, CW - 11], hAlign="LEFT")
t.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ("TOPPADDING", (0, 0), (-1, -1), 1.6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 1.6),
]))
story.append(t)
story.append(Spacer(1, 8))
story.append(Rule(CW, RULE, 0.6))
story.append(Spacer(1, 5))
story.append(Paragraph(
    "<b>Calibration.</b> 15/15 exact (verdict + subtype) on our 15-case adversarial "
    "suite, identical on the mock and the live-LLM path at temperature 0 \u00b7 27% "
    "abstention \u00b7 100% accuracy when committed \u00b7 rules-only scores 14/15, and "
    "that single divergence is the designed demonstration of what stage 4 adds \u00b7 "
    "306 seeded mutations of our own test data: 0 false GENUINEs, 0 crashes. A "
    "design-verification claim, not a field-accuracy claim \u2014 no labelled corpus of "
    "counterfeit dossiers exists, and that absence is part of the problem. "
    "<b>Repository:</b> github.com/AaronHiresense/Provenance", S_FOOT))

doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
                      topMargin=MARGIN, bottomMargin=MARGIN,
                      title="PROVENANCE - Architecture Note",
                      author="Team Mavericks")
doc.addPageTemplates([PageTemplate(
    id="p", frames=[Frame(MARGIN, MARGIN, CW, PH - 2 * MARGIN, id="f",
                          leftPadding=0, rightPadding=0,
                          topPadding=0, bottomPadding=0)])])
doc.build(story)
print("wrote", OUT)
