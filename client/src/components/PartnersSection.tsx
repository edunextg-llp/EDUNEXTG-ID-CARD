import { useEffect, useState, useMemo } from "react";
import {
  api,
  type ApiUser,
  type ApiAuthUser,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Handshake,
  PlusCircle,
  Search,
  MoreVertical,
  Mail,
  ShoppingCart,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Trash2,
  Edit,
  Loader2,
  Users,
  Copy,
  KeyRound,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import {
  isValidIndianMobileNumber,
  INDIAN_MOBILE_ERROR_MESSAGE,
  INDIAN_MOBILE_PLACEHOLDER,
} from "@shared/phoneValidation";

interface PartnersSectionProps {
  currentUser: ApiAuthUser;
  onNavigateToOrders?: (partnerId?: number) => void;
}

export default function PartnersSection({
  currentUser,
  onNavigateToOrders,
}: PartnersSectionProps) {
  const [partners, setPartners] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [orderCounts, setOrderCounts] = useState<Record<number, number>>({});

  // Partner Credentials Modal State
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [credentialsData, setCredentialsData] = useState<{
    partnerName: string;
    loginId: string;
    password?: string;
    email?: string | null;
    phone?: string | null;
    state?: string | null;
    district?: string | null;
  } | null>(null);

  // Add Partner Dialog State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addOpenId, setAddOpenId] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addState, setAddState] = useState("");
  const [addDistrict, setAddDistrict] = useState("");
  const [showAddPassword, setShowAddPassword] = useState(false);
  const [addErrors, setAddErrors] = useState<{
    name?: string;
    email?: string;
    openId?: string;
    password?: string;
    phone?: string;
    state?: string;
    district?: string;
  }>({});
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Edit Partner Dialog State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<ApiUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editState, setEditState] = useState("");
  const [editDistrict, setEditDistrict] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editErrors, setEditErrors] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    state?: string;
    district?: string;
    password?: string;
  }>({});
  const [submittingEdit, setSubmittingEdit] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allUsers, ordersRes] = await Promise.all([
        api.users.list().catch(() => []),
        api.orders.list({ pageSize: 100 }).catch(() => ({ items: [], total: 0 })),
      ]);

      const partnerUsers = allUsers.filter(
        (u) =>
          u.role === "PARTNER" ||
          u.role === "PARTNER_ADMIN" ||
          u.role === "MARKETING_ADMIN"
      );
      setPartners((prev) => {
        const credsMap = new Map(prev.map((p) => [p.id, p.credentials]));
        return partnerUsers.map((p) => ({
          ...p,
          credentials: credsMap.get(p.id) || p.credentials,
        }));
      });

      // Compute order counts per partner
      const counts: Record<number, number> = {};
      for (const ord of ordersRes.items || []) {
        if (ord.placedByUserId) {
          counts[ord.placedByUserId] = (counts[ord.placedByUserId] || 0) + 1;
        }
      }
      setOrderCounts(counts);
    } catch (err) {
      console.error("Failed to load partners data", err);
      toast.error("Could not load partners");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered partners
  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      if (statusFilter === "ACTIVE" && !p.isActive) return false;
      if (statusFilter === "INACTIVE" && p.isActive) return false;

      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        p.name?.toLowerCase().includes(term) ||
        p.email?.toLowerCase().includes(term) ||
        p.openId?.toLowerCase().includes(term)
      );
    });
  }, [partners, search, statusFilter]);

  // Statistics
  const totalPartners = partners.length;
  const activePartners = partners.filter((p) => p.isActive).length;
  const inactivePartners = totalPartners - activePartners;
  const totalOrdersPlaced = Object.values(orderCounts).reduce((a, b) => a + b, 0);

  const copyPartnerDetail = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`);
    }
  };

  const handleGenerateCredentials = async (partner: ApiUser, regenerate = false) => {
    if (currentUser.role !== "SUPER_ADMIN") {
      return toast.error("Only Super Admins can manage partner credentials");
    }
    try {
      const creds = await api.users.generateCredentials(partner.id, { regenerate });
      setPartners((items) =>
        items.map((item) =>
          item.id === partner.id
            ? { ...item, credentials: creds.credentials }
            : item,
        ),
      );
      setCredentialsData({
        partnerName: partner.name || partner.openId || "Partner",
        loginId: creds.credentials.loginId,
        password: creds.credentials.password,
        email: partner.email,
        phone: creds.credentials.phone || partner.phone,
        state: partner.state,
        district: partner.district,
      });
      setCredentialsModalOpen(true);
      toast.success(
        regenerate
          ? `New ID Pass generated for ${partner.name || partner.openId}`
          : partner.credentials?.password
          ? `Credentials loaded for ${partner.name || partner.openId}`
          : `Credentials generated for ${partner.name || partner.openId}`,
      );
    } catch (err: any) {
      toast.error("Failed to retrieve credentials", {
        description: err instanceof Error ? err.message : "Request failed",
      });
    }
  };

  // Auto-generate Login ID based on name
  const handleNameChange = (val: string) => {
    setAddName(val);
    if (!addOpenId || addOpenId.startsWith("partner_") || addOpenId.startsWith("ptr_")) {
      const slug = val
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .slice(0, 16);
      if (slug) {
        setAddOpenId(`partner_${slug}`);
      }
    }
    setAddErrors((prev) => ({ ...prev, name: undefined }));
  };

  // Add Partner submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: typeof addErrors = {};

    if (!addName.trim()) errors.name = "Full name is required";
    if (!addEmail.trim()) {
      errors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addEmail.trim())) {
      errors.email = "Enter a valid email address";
    }

    if (!addOpenId.trim()) {
      errors.openId = "Login ID / Username is required";
    } else if (addOpenId.trim().length < 3) {
      errors.openId = "Login ID must be at least 3 characters";
    }

    if (!addPassword) {
      errors.password = "Password is required";
    } else if (addPassword.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }

    if (addPhone.trim() && !isValidIndianMobileNumber(addPhone.trim())) {
      errors.phone = INDIAN_MOBILE_ERROR_MESSAGE;
    }

    if (Object.keys(errors).length > 0) {
      setAddErrors(errors);
      return;
    }

    setSubmittingAdd(true);
    try {
      const partnerName = addName.trim();
      const loginId = addOpenId.trim();
      const password = addPassword;
      const email = addEmail.trim().toLowerCase();
      const phone = addPhone.trim() || undefined;
      const state = addState.trim() || undefined;
      const district = addDistrict.trim() || undefined;

      const newUser = await api.users.create({
        name: partnerName,
        email,
        openId: loginId,
        password,
        phone,
        state,
        district,
        role: "PARTNER" as any,
        schoolId: null,
      });

      toast.success(`Partner "${partnerName}" added successfully!`);
      setAddModalOpen(false);

      // Open credentials modal
      setCredentialsData({
        partnerName,
        loginId,
        password,
        email,
        phone: phone || null,
        state: state || null,
        district: district || null,
      });
      setCredentialsModalOpen(true);

      // Reset form
      setAddName("");
      setAddEmail("");
      setAddOpenId("");
      setAddPassword("");
      setAddPhone("");
      setAddState("");
      setAddDistrict("");
      setAddErrors({});
      await loadData();

      if (newUser?.id) {
        setPartners((items) =>
          items.map((p) =>
            p.id === newUser.id
              ? {
                  ...p,
                  phone: phone || null,
                  state: state || null,
                  district: district || null,
                  credentials: { loginId, password, email, phone: phone || "", name: partnerName },
                }
              : p,
          ),
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to add partner");
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (partner: ApiUser) => {
    setEditingPartner(partner);
    setEditName(partner.name || "");
    setEditEmail(partner.email || "");
    setEditPhone(partner.phone || "");
    setEditState(partner.state || "");
    setEditDistrict(partner.district || "");
    setEditPassword("");
    setEditErrors({});
    setEditModalOpen(true);
  };

  // Edit Partner submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner) return;

    const errors: typeof editErrors = {};
    if (!editName.trim()) errors.name = "Full name is required";
    if (!editEmail.trim()) {
      errors.email = "Email address is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) {
      errors.email = "Enter a valid email address";
    }

    if (editPassword && editPassword.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }

    if (editPhone.trim() && !isValidIndianMobileNumber(editPhone.trim())) {
      errors.phone = INDIAN_MOBILE_ERROR_MESSAGE;
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setSubmittingEdit(true);
    try {
      await api.users.update(editingPartner.id, {
        name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
        phone: editPhone.trim() || undefined,
        state: editState.trim() || undefined,
        district: editDistrict.trim() || undefined,
        role: "PARTNER",
        schoolId: null,
        ...(editPassword ? { password: editPassword } : {}),
      });

      toast.success(`Partner "${editName.trim()}" updated successfully!`);
      setEditModalOpen(false);
      setEditingPartner(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update partner");
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Toggle active/inactive status
  const handleToggleStatus = async (partner: ApiUser) => {
    try {
      await api.users.setStatus(partner.id, !partner.isActive);
      toast.success(
        `Partner "${partner.name || partner.email}" marked as ${
          !partner.isActive ? "Active" : "Inactive"
        }`
      );
      setPartners((prev) =>
        prev.map((p) => (p.id === partner.id ? { ...p, isActive: !p.isActive } : p))
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  // Delete partner
  const handleDeletePartner = async (partner: ApiUser) => {
    if (
      !window.confirm(
        `Are you sure you want to delete partner "${partner.name || partner.email}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await api.users.delete(partner.id);
      toast.success(`Partner "${partner.name || partner.email}" deleted successfully`);
      setPartners((prev) => prev.filter((p) => p.id !== partner.id));
    } catch (err: any) {
      toast.error(err.message || "Failed to delete partner");
    }
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-[-0.05em] sm:text-3xl text-foreground">
            Partners
          </h2>

        </div>
        <Button
          onClick={() => {
            setAddName("");
            setAddEmail("");
            setAddOpenId("");
            setAddPassword("");
            setAddPhone("");
            setAddState("");
            setAddDistrict("");
            setAddErrors({});
            setAddModalOpen(true);
          }}
          className="h-10 rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary/90 gap-2 shrink-0 cursor-pointer shadow-sm"
        >
          <PlusCircle className="h-4 w-4" /> Add Partner
        </Button>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-border bg-card text-card-foreground shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Partners
            </CardTitle>
            <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{totalPartners}</div>

          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card text-card-foreground shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Active Partners
            </CardTitle>
            <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {activePartners}
            </div>

          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card text-card-foreground shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Inactive Partners
            </CardTitle>
            <UserX className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{inactivePartners}</div>

          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card text-card-foreground shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Partner Orders
            </CardTitle>
            <ShoppingCart className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{totalOrdersPlaced}</div>

          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="rounded-3xl border-border bg-card shadow-[0_12px_35px_rgba(38,71,65,0.05)]">
        {/* Controls Bar */}
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, login ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 rounded-xl border-border bg-background pl-9 text-xs shadow-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground">Filter:</span>
            {(["ALL", "ACTIVE", "INACTIVE"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatusFilter(filter)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  statusFilter === filter
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {filter === "ALL" ? "All Partners" : filter === "ACTIVE" ? "Active" : "Inactive"}
              </button>
            ))}
          </div>
        </div>

        {/* Partners Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[980px]">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold text-[11px]">
              <tr>
                <th className="px-5 py-3.5">Partner Name</th>
                <th className="px-5 py-3.5">Phone</th>
                <th className="px-5 py-3.5">Partner Login ID</th>
                <th className="px-5 py-3.5">Password / ID Pass</th>
                <th className="px-5 py-3.5">Orders</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-xs text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span>Loading registered partners…</span>
                    </div>
                  </td>
                </tr>
              ) : filteredPartners.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-xs text-muted-foreground">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-3">
                      <Handshake className="h-6 w-6" />
                    </div>
                    <p className="font-semibold text-foreground text-sm">No partners found</p>
                    <p className="mt-1">
                      {search || statusFilter !== "ALL"
                        ? "No partners match your current filters. Try resetting the search or filter."
                        : ""}
                    </p>
                    {!search && statusFilter === "ALL" && (
                      <Button
                        onClick={() => {
                          setAddName("");
                          setAddEmail("");
                          setAddOpenId("");
                          setAddPassword("");
                          setAddPhone("");
                          setAddState("");
                          setAddDistrict("");
                          setAddErrors({});
                          setAddModalOpen(true);
                        }}
                        className="mt-4 rounded-xl bg-primary text-primary-foreground font-bold cursor-pointer"
                      >
                        <PlusCircle className="h-4 w-4 mr-1.5" /> Add First Partner
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                filteredPartners.map((partner) => {
                  const partnerOrdersCount = orderCounts[partner.id] || 0;
                  const initials = (partner.name || "Partner")
                    .split(" ")
                    .map((n) => n[0])
                    .filter(Boolean)
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  return (
                    <tr key={partner.id} className="hover:bg-muted/30 transition-colors">
                      {/* Partner Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-extrabold text-sm shadow-xs">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-foreground">
                              <span className="truncate">{partner.name || "Unnamed Partner"}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                              {partner.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                                  <span className="truncate">{partner.email}</span>
                                </span>
                              )}
                              {(partner.district || partner.state) && (
                                <span className="flex items-center gap-1 font-medium text-foreground/80">
                                  <MapPin className="h-3 w-3 text-primary shrink-0" />
                                  <span>{[partner.district, partner.state].filter(Boolean).join(", ")}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {partner.phone ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">{partner.phone}</span>
                            <button
                              type="button"
                              onClick={() => void copyPartnerDetail(partner.phone!, "Phone number")}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-primary hover:bg-primary/10 cursor-pointer"
                              title="Copy phone number"
                              aria-label={`Copy phone number for ${partner.name}`}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not added</span>
                        )}
                      </td>

                      {/* Partner Login ID */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {partner.openId ? (
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-md bg-primary/10 px-2 py-1 font-mono font-bold text-primary">
                              {partner.openId}
                            </span>
                            <button
                              type="button"
                              onClick={() => void copyPartnerDetail(partner.openId!, "Partner Login ID")}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-primary hover:bg-primary/10 cursor-pointer"
                              title="Copy Partner Login ID"
                              aria-label={`Copy Partner Login ID for ${partner.name}`}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Not generated</span>
                        )}
                      </td>

                      {/* Password / ID Pass */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {currentUser.role === "SUPER_ADMIN" && partner.credentials?.password ? (
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-md border border-border bg-muted px-2 py-1 font-mono font-bold text-foreground">
                              {partner.credentials.password}
                            </span>
                            <button
                              type="button"
                              onClick={() => void copyPartnerDetail(partner.credentials!.password, "ID Pass")}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-primary hover:bg-primary/10 cursor-pointer"
                              title="Copy ID Pass"
                              aria-label={`Copy ID Pass for ${partner.name}`}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : currentUser.role === "SUPER_ADMIN" ? (
                          <button
                            type="button"
                            onClick={() => handleGenerateCredentials(partner)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary hover:bg-primary/15 cursor-pointer"
                            title="Generate a new ID Pass to display and copy"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            Generate to view
                          </button>
                        ) : (
                          <span className="text-muted-foreground">Restricted</span>
                        )}
                      </td>

                      {/* Orders */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onNavigateToOrders?.(partner.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-muted/60 hover:bg-muted border border-border text-xs font-semibold text-foreground transition-colors cursor-pointer"
                          title="View orders placed by this partner"
                        >
                          <ShoppingCart className="h-3.5 w-3.5 text-primary" />
                          <span>
                            <b>{partnerOrdersCount}</b> {partnerOrdersCount === 1 ? "order" : "orders"}
                          </span>
                        </button>
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={partner.isActive}
                            onCheckedChange={() => handleToggleStatus(partner)}
                            aria-label={`Toggle status for ${partner.name}`}
                          />
                          <span
                            className={`text-xs font-bold ${
                              partner.isActive
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground"
                            }`}
                          >
                            {partner.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg border border-border hover:bg-muted cursor-pointer"
                              aria-label={`Actions for ${partner.name}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border border-border">
                            {currentUser.role === "SUPER_ADMIN" && (
                              <DropdownMenuItem
                                onClick={() => handleGenerateCredentials(partner)}
                                className="cursor-pointer font-medium text-xs gap-2 text-primary focus:text-primary"
                              >
                                <KeyRound className="h-3.5 w-3.5 text-primary" /> Generate ID Pass
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => openEditModal(partner)}
                              className="cursor-pointer font-medium text-xs gap-2"
                            >
                              <Edit className="h-3.5 w-3.5 text-muted-foreground" /> Edit Partner
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => onNavigateToOrders?.(partner.id)}
                              className="cursor-pointer font-medium text-xs gap-2"
                            >
                              <ShoppingCart className="h-3.5 w-3.5 text-primary" /> View Orders
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeletePartner(partner)}
                              className="cursor-pointer font-medium text-xs gap-2 text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete Partner
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Partner Dialog */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-xl md:max-w-2xl bg-card border border-border rounded-3xl p-6 sm:p-7 max-h-[90vh] flex flex-col shadow-2xl">
          <form onSubmit={handleAddSubmit} className="flex flex-col flex-1 min-h-0">
            <DialogHeader className="text-left pb-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Handshake className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-black text-foreground">
                    Add New Partner
                  </DialogTitle>
                  <DialogDescription className="sr-only">
                    Add New Partner
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 overflow-y-auto flex-1 pr-1">
              {/* Full Name */}
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-foreground">
                  Partner / Representative Name <span className="text-red-500">*</span>
                </label>
                <Input
                  className="mt-1 h-10 rounded-xl"
                  placeholder="e.g., Rajesh Kumar"
                  value={addName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  autoComplete="off"
                  autoFocus
                />
                {addErrors.name && (
                  <p className="mt-1 text-xs font-medium text-red-600">{addErrors.name}</p>
                )}
              </div>

              {/* Email Address */}
              <div>
                <label className="text-xs font-bold text-foreground">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  className="mt-1 h-10 rounded-xl"
                  placeholder="e.g., rajesh@partneragency.com"
                  value={addEmail}
                  onChange={(e) => {
                    setAddEmail(e.target.value);
                    setAddErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  autoComplete="off"
                />
                {addErrors.email && (
                  <p className="mt-1 text-xs font-medium text-red-600">{addErrors.email}</p>
                )}
              </div>

              {/* Contact Phone */}
              <div>
                <label className="text-xs font-bold text-foreground">
                  Contact Phone (Optional)
                </label>
                <Input
                  className="mt-1 h-10 rounded-xl"
                  placeholder={INDIAN_MOBILE_PLACEHOLDER}
                  value={addPhone}
                  onChange={(e) => {
                    setAddPhone(e.target.value);
                    setAddErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  autoComplete="off"
                />
                {addErrors.phone && (
                  <p className="mt-1 text-xs font-medium text-red-600">{addErrors.phone}</p>
                )}
              </div>

              {/* State */}
              <div>
                <label className="text-xs font-bold text-foreground">
                  State
                </label>
                <Input
                  className="mt-1 h-10 rounded-xl"
                  placeholder="e.g., Maharashtra, Delhi, Karnataka"
                  value={addState}
                  onChange={(e) => setAddState(e.target.value)}
                  autoComplete="off"
                />
              </div>

              {/* District */}
              <div>
                <label className="text-xs font-bold text-foreground">
                  District
                </label>
                <Input
                  className="mt-1 h-10 rounded-xl"
                  placeholder="e.g., Pune, Mumbai Suburban, Bengaluru"
                  value={addDistrict}
                  onChange={(e) => setAddDistrict(e.target.value)}
                  autoComplete="off"
                />
              </div>

              {/* Login ID / Username */}
              <div>
                <label className="text-xs font-bold text-foreground">
                  Login ID / Username <span className="text-red-500">*</span>
                </label>
                <Input
                  className="mt-1 h-10 rounded-xl font-mono text-xs"
                  placeholder="e.g., partner_rajesh"
                  value={addOpenId}
                  onChange={(e) => {
                    setAddOpenId(e.target.value);
                    setAddErrors((prev) => ({ ...prev, openId: undefined }));
                  }}
                  autoComplete="off"
                />
                {addErrors.openId && (
                  <p className="mt-1 text-xs font-medium text-red-600">{addErrors.openId}</p>
                )}
              </div>

              {/* Temporary Password */}
              <div>
                <label className="text-xs font-bold text-foreground">
                  Temporary Password <span className="text-red-500">*</span>
                </label>
                <div className="relative mt-1">
                  <Input
                    type={showAddPassword ? "text" : "password"}
                    className="h-10 rounded-xl pr-10"
                    placeholder="Min 8 characters"
                    value={addPassword}
                    onChange={(e) => {
                      setAddPassword(e.target.value);
                      setAddErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showAddPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {addErrors.password && (
                  <p className="mt-1 text-xs font-medium text-red-600">{addErrors.password}</p>
                )}
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border gap-2 sm:gap-3 shrink-0 flex-row justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddModalOpen(false)}
                className="rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingAdd}
                className="rounded-xl bg-primary font-bold text-primary-foreground cursor-pointer"
              >
                {submittingAdd ? "Adding Partner…" : "Add Partner"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Partner Dialog */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-xl md:max-w-2xl bg-card border border-border rounded-3xl p-6 sm:p-7 max-h-[90vh] flex flex-col shadow-2xl">
          <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 min-h-0">
            <DialogHeader className="text-left pb-4 border-b border-border shrink-0">
              <DialogTitle className="text-lg font-black text-foreground">
                Edit Partner: {editingPartner?.name || editingPartner?.email}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Edit Partner
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 overflow-y-auto flex-1 pr-1">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-foreground">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <Input
                  className="mt-1 h-10 rounded-xl"
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    setEditErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                />
                {editErrors.name && (
                  <p className="mt-1 text-xs font-medium text-red-600">{editErrors.name}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-foreground">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  className="mt-1 h-10 rounded-xl"
                  value={editEmail}
                  onChange={(e) => {
                    setEditEmail(e.target.value);
                    setEditErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                />
                {editErrors.email && (
                  <p className="mt-1 text-xs font-medium text-red-600">{editErrors.email}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-foreground">
                  Contact Phone (Optional)
                </label>
                <Input
                  className="mt-1 h-10 rounded-xl"
                  placeholder={INDIAN_MOBILE_PLACEHOLDER}
                  value={editPhone}
                  onChange={(e) => {
                    setEditPhone(e.target.value);
                    setEditErrors((prev) => ({ ...prev, phone: undefined }));
                  }}
                  autoComplete="off"
                />
                {editErrors.phone && (
                  <p className="mt-1 text-xs font-medium text-red-600">{editErrors.phone}</p>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-foreground">
                  State
                </label>
                <Input
                  className="mt-1 h-10 rounded-xl"
                  placeholder="e.g., Maharashtra, Delhi"
                  value={editState}
                  onChange={(e) => setEditState(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground">
                  District
                </label>
                <Input
                  className="mt-1 h-10 rounded-xl"
                  placeholder="e.g., Pune, Mumbai"
                  value={editDistrict}
                  onChange={(e) => setEditDistrict(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-foreground">
                  Reset Password (leave blank to keep current)
                </label>
                <div className="relative mt-1">
                  <Input
                    type={showEditPassword ? "text" : "password"}
                    className="h-10 rounded-xl pr-10"
                    placeholder="Leave empty to keep unchanged"
                    value={editPassword}
                    onChange={(e) => {
                      setEditPassword(e.target.value);
                      setEditErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {editErrors.password && (
                  <p className="mt-1 text-xs font-medium text-red-600">{editErrors.password}</p>
                )}
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-border gap-2 sm:gap-3 shrink-0 flex-row justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditModalOpen(false)}
                className="rounded-xl cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingEdit}
                className="rounded-xl bg-primary font-bold text-primary-foreground cursor-pointer"
              >
                {submittingEdit ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Partner Credentials & ID Pass Modal */}
      <Dialog open={credentialsModalOpen} onOpenChange={setCredentialsModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border border-border rounded-2xl shadow-xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-extrabold text-foreground">
                  Partner ID Pass & Credentials
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  {credentialsData?.partnerName
                    ? `Login credentials for ${credentialsData.partnerName}`
                    : "Partner login credentials"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Partner Details */}
            <div className="rounded-xl border border-border bg-muted/40 p-3.5 text-xs text-foreground space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="font-bold text-primary flex items-center gap-1.5">
                  <Handshake className="h-4 w-4" /> {credentialsData?.partnerName || "Partner Details"}
                </span>
                <span className="font-mono text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                  Partner
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-0.5">
                <div>
                  <span className="text-muted-foreground font-medium block">Email:</span>
                  <span className="font-semibold text-foreground break-all">
                    {credentialsData?.email || "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground font-medium block">Phone:</span>
                  <span className="font-semibold text-foreground">
                    {credentialsData?.phone || "—"}
                  </span>
                </div>
                {(credentialsData?.district || credentialsData?.state) && (
                  <div className="sm:col-span-2 pt-1 border-t border-border">
                    <span className="text-muted-foreground font-medium block">Location:</span>
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-primary shrink-0" />
                      {[credentialsData?.district, credentialsData?.state].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Login ID field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Partner Login ID</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono text-sm font-bold text-foreground bg-muted px-3 py-2 rounded-xl border border-border select-all break-all">
                  {credentialsData?.loginId || "—"}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-9 rounded-xl border-border text-xs font-bold hover:bg-muted hover:text-primary cursor-pointer"
                  onClick={() => {
                    if (credentialsData?.loginId) {
                      navigator.clipboard.writeText(credentialsData.loginId);
                      toast.success("Login ID copied to clipboard");
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                </Button>
              </div>
            </div>

            {/* Password / ID Pass field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Password / ID Pass</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono text-sm font-bold text-foreground bg-muted px-3 py-2 rounded-xl border border-border select-all break-all">
                  {credentialsData?.password || "••••••••••••"}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 h-9 rounded-xl border-border text-xs font-bold hover:bg-muted hover:text-primary cursor-pointer"
                  onClick={() => {
                    if (credentialsData?.password) {
                      navigator.clipboard.writeText(credentialsData.password);
                      toast.success("Password copied to clipboard");
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-between sm:items-center pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl border-border text-xs font-bold text-primary hover:bg-muted cursor-pointer"
              onClick={() => {
                if (credentialsData) {
                  const lines = [
                    `Partner: ${credentialsData.partnerName}`,
                    credentialsData.email ? `Email: ${credentialsData.email}` : null,
                    credentialsData.phone ? `Phone: ${credentialsData.phone}` : null,
                    (credentialsData.district || credentialsData.state) ? `Location: ${[credentialsData.district, credentialsData.state].filter(Boolean).join(", ")}` : null,
                    `Login ID: ${credentialsData.loginId}`,
                    `Password: ${credentialsData.password || ""}`,
                    `Portal URL: ${window.location.origin}`,
                  ].filter(Boolean);
                  navigator.clipboard.writeText(lines.join("\n"));
                  toast.success("All credentials and partner details copied to clipboard");
                }
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy All Details
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-primary text-xs font-bold text-white hover:bg-primary/90 cursor-pointer"
              onClick={() => setCredentialsModalOpen(false)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
