import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useUpload } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  FileCheck,
  Upload,
  Download,
  Eye,
  Trash2,
  Plus,
  Edit2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  CreditCard,
  UserPlus,
  Shield,
  GraduationCap,
  Briefcase,
  Users,
} from "lucide-react";

interface EmployeeDocument {
  id: string;
  userId: string;
  category: string;
  documentType: string;
  fileName: string | null;
  fileUrl: string | null;
  fileSize: number | null;
  status: string;
  isRequired: boolean;
  remarks: string | null;
  uploadedAt: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BankDetails {
  id: string;
  userId: string;
  accountNumber: string | null;
  ifscCode: string | null;
  bankName: string | null;
  branchName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  relationship: string;
  phone: string;
  email: string | null;
  address: string | null;
  isPrimary: boolean;
  createdAt: string;
}

const categoryConfig: Record<string, { label: string; icon: typeof Shield; description: string }> = {
  identity: { label: "Identity & KYC", icon: Shield, description: "Government-issued identity documents" },
  education: { label: "Education", icon: GraduationCap, description: "Academic certificates and marksheets" },
  employment: { label: "Previous Employment", icon: Briefcase, description: "Documents from previous employers" },
  bank: { label: "Bank Details", icon: CreditCard, description: "Banking and financial documents" },
};

const docTypeLabels: Record<string, string> = {
  aadhaar: "Aadhaar Card",
  pan: "PAN Card",
  passport: "Passport",
  voter_id: "Voter ID",
  driving_license: "Driving License",
  "10th_marksheet": "10th Marksheet",
  "12th_marksheet": "12th Marksheet",
  graduation_cert: "Graduation Certificate",
  postgrad_cert: "Post-Graduation Certificate",
  relieving_letter: "Relieving Letter",
  salary_slips_prev: "Last 3 Months Salary Slips",
  form16: "Form 16",
  cancelled_cheque: "Cancelled Cheque",
};

const statusConfig: Record<string, { label: string; icon: typeof Clock; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", icon: Clock, variant: "outline" },
  uploaded: { label: "Uploaded", icon: Upload, variant: "secondary" },
  verified: { label: "Verified", icon: CheckCircle2, variant: "default" },
  rejected: { label: "Rejected", icon: XCircle, variant: "destructive" },
};

const bankFormSchema = z.object({
  accountNumber: z.string().min(1, "Account number is required"),
  ifscCode: z.string().min(1, "IFSC code is required"),
  bankName: z.string().min(1, "Bank name is required"),
  branchName: z.string().min(1, "Branch name is required"),
});

const contactFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  relationship: z.string().min(1, "Relationship is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

export default function MyDocuments() {
  const { toast } = useToast();
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);

  const { data: documents, isLoading: docsLoading } = useQuery<EmployeeDocument[]>({
    queryKey: ["/api/hr/my-documents"],
  });

  const { data: bankDetails, isLoading: bankLoading } = useQuery<BankDetails | null>({
    queryKey: ["/api/hr/my-bank-details"],
  });

  const { data: emergencyContacts, isLoading: contactsLoading } = useQuery<EmergencyContact[]>({
    queryKey: ["/api/hr/my-emergency-contacts"],
  });

  const { uploadFile, isUploading } = useUpload({
    onSuccess: () => {},
    onError: (error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const updateDocMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { fileName: string; fileUrl: string; fileSize: number } }) => {
      const res = await apiRequest("PATCH", `/api/hr/my-documents/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/my-documents"] });
      toast({ title: "Document uploaded successfully" });
      setUploadingDocId(null);
    },
    onError: () => {
      toast({ title: "Failed to update document", variant: "destructive" });
    },
  });

  const saveBankMutation = useMutation({
    mutationFn: async (data: z.infer<typeof bankFormSchema>) => {
      const res = await apiRequest("POST", "/api/hr/my-bank-details", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/my-bank-details"] });
      toast({ title: "Bank details saved successfully" });
    },
    onError: () => {
      toast({ title: "Failed to save bank details", variant: "destructive" });
    },
  });

  const createContactMutation = useMutation({
    mutationFn: async (data: z.infer<typeof contactFormSchema>) => {
      const res = await apiRequest("POST", "/api/hr/my-emergency-contacts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/my-emergency-contacts"] });
      toast({ title: "Emergency contact added" });
      setContactDialogOpen(false);
      setEditingContact(null);
    },
    onError: () => {
      toast({ title: "Failed to save contact", variant: "destructive" });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof contactFormSchema> }) => {
      const res = await apiRequest("PATCH", `/api/hr/my-emergency-contacts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/my-emergency-contacts"] });
      toast({ title: "Emergency contact updated" });
      setContactDialogOpen(false);
      setEditingContact(null);
    },
    onError: () => {
      toast({ title: "Failed to update contact", variant: "destructive" });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/hr/my-emergency-contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/my-emergency-contacts"] });
      toast({ title: "Emergency contact deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete contact", variant: "destructive" });
    },
  });

  const handleFileUpload = async (docId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingDocId(docId);
    const result = await uploadFile(file);
    if (result) {
      updateDocMutation.mutate({
        id: docId,
        data: {
          fileName: file.name,
          fileUrl: result.objectPath,
          fileSize: file.size,
        },
      });
    } else {
      setUploadingDocId(null);
    }
  };

  const requiredDocs = documents?.filter((d) => d.isRequired) || [];
  const uploadedRequired = requiredDocs.filter((d) => d.status !== "pending").length;
  const progressPercent = requiredDocs.length > 0 ? Math.round((uploadedRequired / requiredDocs.length) * 100) : 0;

  const groupedByCategory = (documents || []).reduce<Record<string, EmployeeDocument[]>>((acc, doc) => {
    if (!acc[doc.category]) acc[doc.category] = [];
    acc[doc.category].push(doc);
    return acc;
  }, {});

  const bankForm = useForm<z.infer<typeof bankFormSchema>>({
    resolver: zodResolver(bankFormSchema),
    defaultValues: {
      accountNumber: bankDetails?.accountNumber || "",
      ifscCode: bankDetails?.ifscCode || "",
      bankName: bankDetails?.bankName || "",
      branchName: bankDetails?.branchName || "",
    },
    values: bankDetails ? {
      accountNumber: bankDetails.accountNumber || "",
      ifscCode: bankDetails.ifscCode || "",
      bankName: bankDetails.bankName || "",
      branchName: bankDetails.branchName || "",
    } : undefined,
  });

  const contactForm = useForm<z.infer<typeof contactFormSchema>>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      relationship: "",
      phone: "",
      email: "",
      address: "",
      isPrimary: false,
    },
  });

  const openContactDialog = (contact?: EmergencyContact) => {
    if (contact) {
      setEditingContact(contact);
      contactForm.reset({
        name: contact.name,
        relationship: contact.relationship,
        phone: contact.phone,
        email: contact.email || "",
        address: contact.address || "",
        isPrimary: contact.isPrimary,
      });
    } else {
      setEditingContact(null);
      contactForm.reset({
        name: "",
        relationship: "",
        phone: "",
        email: "",
        address: "",
        isPrimary: false,
      });
    }
    setContactDialogOpen(true);
  };

  const onContactSubmit = (data: z.infer<typeof contactFormSchema>) => {
    if (editingContact) {
      updateContactMutation.mutate({ id: editingContact.id, data });
    } else {
      createContactMutation.mutate(data);
    }
  };

  if (docsLoading || bankLoading || contactsLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6" data-testid="loading-my-documents">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full" />
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
    <div className="space-y-6" data-testid="page-my-documents">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">My Documents</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload your onboarding documents and complete your profile
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
          <div>
            <CardTitle className="text-base">Overall Progress</CardTitle>
            <CardDescription>
              {uploadedRequired} of {requiredDocs.length} required documents uploaded
            </CardDescription>
          </div>
          <span className="text-2xl font-bold" data-testid="text-progress-percent">
            {progressPercent}%
          </span>
        </CardHeader>
        <CardContent>
          <Progress value={progressPercent} className="h-3" data-testid="progress-documents" />
        </CardContent>
      </Card>

      {(["identity", "education", "employment", "bank"] as const).map((category) => {
        const config = categoryConfig[category];
        const docs = groupedByCategory[category] || [];
        const CategoryIcon = config.icon;

        return (
          <Card key={category} data-testid={`card-category-${category}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3 flex-wrap">
                <CategoryIcon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-lg">{config.label}</CardTitle>
                  <CardDescription>{config.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {docs.map((doc) => {
                const status = statusConfig[doc.status] || statusConfig.pending;
                const StatusIcon = status.icon;
                const isCurrentlyUploading = uploadingDocId === doc.id && (isUploading || updateDocMutation.isPending);

                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between gap-4 p-3 rounded-md border flex-wrap"
                    data-testid={`doc-row-${doc.documentType}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">
                            {docTypeLabels[doc.documentType] || doc.documentType}
                          </span>
                          <Badge
                            variant={doc.isRequired ? "default" : "outline"}
                            className="text-xs"
                            data-testid={`badge-required-${doc.documentType}`}
                          >
                            {doc.isRequired ? "Required" : "Optional"}
                          </Badge>
                        </div>
                        {doc.fileName && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[200px]">
                            {doc.fileName}
                          </p>
                        )}
                        {doc.status === "rejected" && doc.remarks && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
                            <AlertCircle className="h-3 w-3" />
                            <span>{doc.remarks}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={status.variant} data-testid={`badge-status-${doc.documentType}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>

                      {doc.fileUrl && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => window.open(doc.fileUrl!, "_blank")}
                          data-testid={`button-view-${doc.documentType}`}
                        >
                          <Eye />
                        </Button>
                      )}

                      <label>
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={(e) => handleFileUpload(doc.id, e)}
                          disabled={isCurrentlyUploading}
                          data-testid={`input-upload-${doc.documentType}`}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isCurrentlyUploading}
                          asChild
                          data-testid={`button-upload-${doc.documentType}`}
                        >
                          <span>
                            <Upload className="h-3 w-3 mr-1" />
                            {isCurrentlyUploading ? "Uploading..." : doc.fileUrl ? "Re-upload" : "Upload"}
                          </span>
                        </Button>
                      </label>
                    </div>
                  </div>
                );
              })}
              {docs.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No documents in this category yet.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Card data-testid="card-bank-details">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg">Bank Account Details</CardTitle>
              <CardDescription>Your salary account information</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...bankForm}>
            <form onSubmit={bankForm.handleSubmit((data) => saveBankMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={bankForm.control}
                  name="accountNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter account number" {...field} data-testid="input-account-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={bankForm.control}
                  name="ifscCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IFSC Code</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. SBIN0001234" {...field} data-testid="input-ifsc-code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={bankForm.control}
                  name="bankName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bank Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. State Bank of India" {...field} data-testid="input-bank-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={bankForm.control}
                  name="branchName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Main Branch" {...field} data-testid="input-branch-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={saveBankMutation.isPending} data-testid="button-save-bank">
                {saveBankMutation.isPending ? "Saving..." : "Save Bank Details"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card data-testid="card-emergency-contacts">
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg">Emergency Contacts</CardTitle>
              <CardDescription>People to contact in case of emergency</CardDescription>
            </div>
          </div>
          <Button size="sm" onClick={() => openContactDialog()} data-testid="button-add-contact">
            <Plus className="h-3 w-3 mr-1" />
            Add Contact
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {(emergencyContacts || []).map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between gap-4 p-3 rounded-md border flex-wrap"
              data-testid={`contact-row-${contact.id}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{contact.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {contact.relationship}
                  </Badge>
                  {contact.isPrimary && (
                    <Badge variant="default" className="text-xs">
                      Primary
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{contact.phone}</p>
                {contact.email && (
                  <p className="text-xs text-muted-foreground">{contact.email}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => openContactDialog(contact)}
                  data-testid={`button-edit-contact-${contact.id}`}
                >
                  <Edit2 />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteContactMutation.mutate(contact.id)}
                  disabled={deleteContactMutation.isPending}
                  data-testid={`button-delete-contact-${contact.id}`}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
          {(emergencyContacts || []).length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No emergency contacts added yet. Add at least one contact.
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingContact ? "Edit" : "Add"} Emergency Contact</DialogTitle>
            <DialogDescription>
              {editingContact ? "Update the contact details below." : "Fill in the details for a new emergency contact."}
            </DialogDescription>
          </DialogHeader>
          <Form {...contactForm}>
            <form onSubmit={contactForm.handleSubmit(onContactSubmit)} className="space-y-4">
              <FormField
                control={contactForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Contact name" {...field} data-testid="input-contact-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={contactForm.control}
                  name="relationship"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Relationship</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Spouse, Parent" {...field} data-testid="input-contact-relationship" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={contactForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="Phone number" {...field} data-testid="input-contact-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={contactForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Email address" {...field} data-testid="input-contact-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contactForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Full address" {...field} data-testid="input-contact-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={contactForm.control}
                name="isPrimary"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="input-contact-is-primary"
                      />
                    </FormControl>
                    <FormLabel className="font-normal">Primary contact</FormLabel>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setContactDialogOpen(false)}
                  data-testid="button-cancel-contact"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createContactMutation.isPending || updateContactMutation.isPending}
                  data-testid="button-save-contact"
                >
                  {createContactMutation.isPending || updateContactMutation.isPending
                    ? "Saving..."
                    : editingContact
                    ? "Update"
                    : "Add Contact"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
    </AdminLayout>
  );
}
