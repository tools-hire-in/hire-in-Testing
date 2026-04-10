import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
import { Plus, Edit2, Trash2, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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

const contactFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  relationship: z.string().min(1, "Relationship is required"),
  phone: z.string().min(1, "Phone is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

export function EmergencyContactsSection() {
  const { toast } = useToast();
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);

  const { data: emergencyContacts, isLoading: contactsLoading } = useQuery<EmergencyContact[]>({
    queryKey: ["/api/hr/my-emergency-contacts"],
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

  if (contactsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <>
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
    </>
  );
}
