"""
MedSync Application Flow Diagram Generator
Generates a high-resolution PNG using matplotlib.
Run: pip install matplotlib  (if not installed)
Then: python generate_flow.py
Output: medsync-flow.png (saved in same directory)
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

fig, ax = plt.subplots(1, 1, figsize=(28, 22), dpi=300)
ax.set_xlim(0, 28)
ax.set_ylim(0, 22)
ax.axis('off')
fig.patch.set_facecolor('#ffffff')

# ── Colors ──
C_BLUE = '#3b82f6'
C_BLUE_L = '#dbeafe'
C_AMBER = '#f59e0b'
C_AMBER_L = '#fef3c7'
C_GREEN = '#10b981'
C_GREEN_L = '#d1fae5'
C_PURPLE = '#6366f1'
C_PURPLE_L = '#e0e7ff'
C_PINK = '#ec4899'
C_PINK_L = '#fce7f3'
C_DARK = '#1e293b'
C_DARK_L = '#e2e8f0'
C_GRAY = '#64748b'
C_WHITE = '#ffffff'


def draw_box(x, y, w, h, text, bg, border, fontsize=9, fontcolor='#1e293b', bold=False):
    box = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.15",
                         facecolor=bg, edgecolor=border, linewidth=1.5,
                         transform=ax.transData, zorder=3)
    ax.add_patch(box)
    weight = 'bold' if bold else 'normal'
    ax.text(x + w/2, y + h/2, text, ha='center', va='center',
            fontsize=fontsize, color=fontcolor, fontweight=weight, zorder=4,
            linespacing=1.4)


def draw_diamond(cx, cy, w, h, text, bg, border, fontsize=8):
    diamond = plt.Polygon([
        (cx, cy + h/2), (cx + w/2, cy), (cx, cy - h/2), (cx - w/2, cy)
    ], facecolor=bg, edgecolor=border, linewidth=1.5, zorder=3)
    ax.add_patch(diamond)
    ax.text(cx, cy, text, ha='center', va='center', fontsize=fontsize,
            color='#1e293b', fontweight='bold', zorder=4, linespacing=1.3)


def arrow(x1, y1, x2, y2, label='', color=C_GRAY):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle='->', color=color, lw=1.5),
                zorder=2)
    if label:
        mx, my = (x1+x2)/2, (y1+y2)/2
        ax.text(mx, my + 0.2, label, ha='center', va='bottom',
                fontsize=7, color=color, fontstyle='italic', zorder=5,
                bbox=dict(boxstyle='round,pad=0.1', facecolor='white', edgecolor='none', alpha=0.8))


def draw_section_bg(x, y, w, h, title, bg, border, title_bg):
    rect = FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.2",
                          facecolor=bg, edgecolor=border, linewidth=2,
                          alpha=0.4, zorder=1)
    ax.add_patch(rect)
    title_box = FancyBboxPatch((x + 0.2, y + h - 0.7), w - 0.4, 0.55,
                                boxstyle="round,pad=0.1",
                                facecolor=title_bg, edgecolor=border,
                                linewidth=1.5, zorder=2)
    ax.add_patch(title_box)
    ax.text(x + w/2, y + h - 0.42, title, ha='center', va='center',
            fontsize=11, color=C_WHITE, fontweight='bold', zorder=3)


# ═══════════════════════════════════════════════
# TITLE
# ═══════════════════════════════════════════════
ax.text(14, 21.3, 'MedSync — Application Flow', ha='center', va='center',
        fontsize=22, fontweight='bold', color=C_DARK)
ax.text(14, 20.8, 'AI-Powered Healthcare Communication Platform', ha='center', va='center',
        fontsize=12, color=C_GRAY)

# ═══════════════════════════════════════════════
# ROW 1: AUTH FLOW
# ═══════════════════════════════════════════════
bw, bh = 2.2, 0.7

# Landing Page
draw_box(1.5, 19.0, bw, bh, 'Landing Page', C_BLUE, C_BLUE, fontsize=10, fontcolor=C_WHITE, bold=True)

# Login & Signup
draw_box(5.5, 19.5, bw, 0.6, 'Login', C_BLUE_L, C_BLUE, fontsize=9, bold=True)
draw_box(5.5, 18.5, bw, 0.6, 'Signup', C_BLUE_L, C_BLUE, fontsize=9, bold=True)

# Verify Email
draw_box(9.5, 18.5, bw, 0.6, 'Verify Email', C_BLUE_L, C_BLUE, fontsize=9)

# Reset Password
draw_box(9.5, 19.5, bw, 0.6, 'Reset Password', C_BLUE_L, C_BLUE, fontsize=9)

# Auth Confirm
draw_box(13.5, 18.5, bw, 0.6, 'Auth Confirm', C_BLUE_L, C_BLUE, fontsize=9)

# Arrows: Landing → Login, Landing → Signup
arrow(3.7, 19.35, 5.5, 19.8)
arrow(3.7, 19.35, 5.5, 18.8)

# Login → Reset Password
arrow(7.7, 19.8, 9.5, 19.8)
# Reset Password → Login
arrow(9.5, 19.65, 7.7, 19.65, '')

# Signup → Verify Email
arrow(7.7, 18.8, 9.5, 18.8)
# Verify → Confirm
arrow(11.7, 18.8, 13.5, 18.8)

# ═══════════════════════════════════════════════
# MIDDLEWARE
# ═══════════════════════════════════════════════
draw_diamond(20, 19.0, 4.5, 1.6, 'Middleware\nRate Limit + Session\n+ RBAC', C_AMBER_L, C_AMBER)

# Login → MW
arrow(7.7, 19.8, 17.75, 19.2, '')
# Confirm → MW
arrow(15.7, 18.8, 17.75, 18.9, '')

# MW → unauthorized → Login
arrow(20, 19.8, 20, 20.3)
ax.text(20.1, 20.45, 'unauthorized\n→ Login', fontsize=7, color='#dc2626', ha='left', va='center')

# ═══════════════════════════════════════════════
# ROW 2: THREE DASHBOARDS
# ═══════════════════════════════════════════════

# ── Patient Dashboard ──
draw_section_bg(0.3, 10.5, 8.0, 6.8, 'Patient Dashboard', C_GREEN_L, C_GREEN, C_GREEN)

px, py = 0.8, 15.6
draw_box(px, py, 3.2, 0.6, 'Overview\nHealth Metrics & Stats', C_GREEN_L, C_GREEN, fontsize=8)
draw_box(px+3.8, py, 3.2, 0.6, 'AI Health Assistant\nLLM API', C_GREEN_L, C_GREEN, fontsize=8)
py2 = 14.5
draw_box(px, py2, 3.2, 0.6, 'Secure Chat\nWith Doctors & Labs', C_GREEN_L, C_GREEN, fontsize=8)
draw_box(px+3.8, py2, 3.2, 0.6, 'My Reports\nView & Download', C_GREEN_L, C_GREEN, fontsize=8)
py3 = 13.4
draw_box(px, py3, 3.2, 0.6, 'Video Consultations\nAgora / Zoom', C_GREEN_L, C_GREEN, fontsize=8)
draw_box(px+3.8, py3, 3.2, 0.6, 'Profile Setup', C_GREEN_L, C_GREEN, fontsize=8)

# Internal connections
arrow(2.4, 15.6, 2.4, 15.1)
arrow(6.2, 15.6, 6.2, 15.1)
arrow(2.4, 14.5, 2.4, 14.0)
arrow(6.2, 14.5, 6.2, 14.0)

# ── Doctor Dashboard ──
draw_section_bg(9.5, 10.5, 9.0, 6.8, 'Doctor Dashboard', C_PURPLE_L, C_PURPLE, C_PURPLE)

dx, dy = 10.0, 15.6
draw_box(dx, dy, 2.5, 0.6, 'Overview\nPatient Roster', C_PURPLE_L, C_PURPLE, fontsize=8)
draw_box(dx+3.0, dy, 2.5, 0.6, 'AI Diagnostics\nLLM API', C_PURPLE_L, C_PURPLE, fontsize=8)
draw_box(dx+6.0, dy, 2.0, 0.6, 'Notifications', C_PURPLE_L, C_PURPLE, fontsize=8)
dy2 = 14.5
draw_box(dx, dy2, 2.5, 0.6, 'Communication\nChat w/ Patients', C_PURPLE_L, C_PURPLE, fontsize=8)
draw_box(dx+3.0, dy2, 2.5, 0.6, 'Consultations\nVideo Meetings', C_PURPLE_L, C_PURPLE, fontsize=8)
draw_box(dx+6.0, dy2, 2.0, 0.6, 'Schedule\nAppointments', C_PURPLE_L, C_PURPLE, fontsize=8)
dy3 = 13.4
draw_box(dx, dy3, 2.5, 0.6, 'Medical Records\nPatient History', C_PURPLE_L, C_PURPLE, fontsize=8)
draw_box(dx+3.0, dy3, 2.5, 0.6, 'Reports Review\nAI Analysis', C_PURPLE_L, C_PURPLE, fontsize=8)

# Internal connections
arrow(11.25, 15.6, 11.25, 15.1)
arrow(14.25, 15.6, 14.25, 15.1)
arrow(11.25, 14.5, 11.25, 14.0)
arrow(14.25, 14.5, 14.25, 14.0)

# ── Lab Dashboard ──
draw_section_bg(19.5, 10.5, 8.0, 6.8, 'Lab Dashboard', C_PINK_L, C_PINK, C_PINK)

lx, ly = 20.0, 15.6
draw_box(lx, ly, 3.2, 0.6, 'Overview\nLab Operations', C_PINK_L, C_PINK, fontsize=8)
draw_box(lx+3.8, ly, 3.2, 0.6, 'Communication\nDoctors & Patients', C_PINK_L, C_PINK, fontsize=8)
ly2 = 14.5
draw_box(lx, ly2, 3.2, 0.6, 'Imaging\nLLM-based Analysis', C_PINK_L, C_PINK, fontsize=8)
draw_box(lx+3.8, ly2, 3.2, 0.6, 'Sample Management\nTrack & Process', C_PINK_L, C_PINK, fontsize=8)
ly3 = 13.4
draw_box(lx, ly3, 3.2, 0.6, 'Report Upload\nSecure File Upload', C_PINK_L, C_PINK, fontsize=8)

# Internal connections
arrow(21.6, 15.6, 21.6, 15.1)
arrow(25.4, 15.6, 25.4, 15.1)
arrow(21.6, 14.5, 21.6, 14.0)

# ═══════════════════════════════════════════════
# MW → Dashboards arrows
# ═══════════════════════════════════════════════
arrow(18.0, 18.5, 4.3, 17.3, 'role = patient')
arrow(20.0, 18.2, 14.0, 17.3, 'role = doctor')
arrow(22.0, 18.2, 23.5, 17.3, 'role = lab')

# ═══════════════════════════════════════════════
# ROW 3: BACKEND SERVICES
# ═══════════════════════════════════════════════
draw_section_bg(1.5, 1.0, 25.0, 8.5, 'Shared Backend Services', C_DARK_L, C_DARK, C_DARK)

sx, sy = 2.0, 6.5
sw, sh = 4.2, 2.0

# Supabase
draw_box(sx, sy, sw, sh, 'Supabase\n\nPostgreSQL\nAuthentication\nRealtime Subscriptions\nFile Storage', '#e0f2fe', '#0284c7', fontsize=9, bold=True)

# LLM API
draw_box(sx + 5.5, sy, sw, sh, 'LLM API\n\nAI Chat & Analysis\nReport Interpretation\nDiagnostic Support\nMedical Q&A', '#fef9c3', '#ca8a04', fontsize=9, bold=True)

# Video SDK
draw_box(sx + 11.0, sy, sw, sh, 'Video SDK\n\nAgora RTC\nZoom Meetings SDK\nReal-time Video\nScreen Sharing', '#f3e8ff', '#9333ea', fontsize=9, bold=True)

# API Routes
draw_box(sx + 16.5, sy, sw, sh, 'API Routes\n\nLab Upload\nMeeting Management\nChat Endpoints\nDebug Routes', '#e0e7ff', '#4f46e5', fontsize=9, bold=True)

# Row of data flow labels
dfy = 3.5
draw_box(2.5, dfy, 4.5, 1.3, 'Data Flow\n\nReports → LLM Analysis\nChat → Realtime\nAuth → JWT + RLS', '#f8fafc', C_GRAY, fontsize=8)
draw_box(8.0, dfy, 4.5, 1.3, 'Security\n\nRow Level Security\nRole-based Access\nRate Limiting', '#f8fafc', C_GRAY, fontsize=8)
draw_box(13.5, dfy, 4.5, 1.3, 'Video Flow\n\nDoctor starts call\n→ Patient joins\n→ Agora/Zoom SDK', '#f8fafc', C_GRAY, fontsize=8)
draw_box(19.0, dfy, 4.5, 1.3, 'Real-time\n\nSupabase Channels\nLive Notifications\nChat Messages', '#f8fafc', C_GRAY, fontsize=8)

# Internal service connections
arrow(6.2, 7.5, 7.5, 7.5)
arrow(11.7, 7.5, 13.0, 7.5)
arrow(17.2, 7.5, 18.5, 7.5)

# ═══════════════════════════════════════════════
# Dashboard → Services arrows
# ═══════════════════════════════════════════════
arrow(4.3, 10.5, 4.3, 9.5, '')
arrow(14.0, 10.5, 14.0, 9.5, '')
arrow(23.5, 10.5, 23.5, 9.5, '')

# Specific flow arrows
arrow(21.6, 13.4, 4.1, 9.5, 'upload report')
arrow(6.2, 8.5, 7.5, 8.5, 'LLM analysis')
arrow(14.25, 13.4, 14.5, 9.5, 'start video call')
arrow(2.4, 13.4, 14.5, 9.5, 'join video call')

# ═══════════════════════════════════════════════
# LEGEND
# ═══════════════════════════════════════════════
ax.text(1, 0.5, 'Tech Stack:', fontsize=9, fontweight='bold', color=C_DARK)
ax.text(4, 0.5, 'Next.js 15  •  React 19  •  TypeScript  •  Tailwind CSS  •  shadcn/ui  •  Supabase  •  LLM API  •  Agora RTC  •  Zoom SDK',
        fontsize=8, color=C_GRAY)

# Save
plt.tight_layout()
output_path = 'medsync-flow.png'
plt.savefig(output_path, dpi=300, bbox_inches='tight', facecolor='white', edgecolor='none',
            pad_inches=0.3)
plt.close()

print(f"✅ Saved: {output_path}")
print(f"   Resolution: ~8400 x 6600 pixels at 300 DPI")
print(f"   Open the file to view your diagram!")
