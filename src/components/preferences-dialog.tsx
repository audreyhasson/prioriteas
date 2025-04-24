import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from "@/components/ui/dialog"
import { useForm, FieldValues } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"
  

// Define the schema using zod
const preferencesSchema = z.object({
    bobaHours: z.number().min(1, "Must be at least 1 hour").max(24, "Cannot exceed 24 hours"),
    amEnd: z.string().nonempty("AM end time is required"),
    pmEnd: z.string().nonempty("PM end time is required"),
    dayStart: z.string().nonempty("Day start time is required"),
    dayEnd: z.string().nonempty("Day end time is required"),
})

type PreferencesFormValues = z.infer<typeof preferencesSchema>


export default function PreferencesDialog() {
    // Collect user preferences and save them to the database
    // Options they have:
        // - how many hours corresponds to one boba
        // - what time "AM" ends
        // - what time "PM" ends
        // - what time their day starts
        // - what time their day ends
    const form = useForm<PreferencesFormValues>({
        resolver: zodResolver(preferencesSchema),
        defaultValues: {
            bobaHours: 2,
            amEnd: "12:00",
            pmEnd: "23:59",
            dayStart: "08:00",
            dayEnd: "22:00",
        },
    })

    function onSubmit(values: PreferencesFormValues) {
        console.log("Preferences saved:", values)
        // Add logic to save preferences to the database
    }

    return (
        <Dialog>
        <DialogTrigger>Set Preferences</DialogTrigger>
        <DialogContent>
        <DialogHeader>
                    <DialogTitle>Preferences</DialogTitle>
                    <DialogDescription>
                        Configure your preferences below:
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="bobaHours"
                            render={({ field }: {field: FieldValues}) => (
                                <FormItem>
                                    <FormLabel>How many hours of goals achieved should earn one boba?</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="e.g., 2" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="amEnd"
                            render={({ field }: {field: FieldValues}) => (
                                <FormItem>
                                    <FormLabel>AM ends at:</FormLabel>
                                    <FormControl>
                                        <Input type="time" {...field}/>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="pmEnd"
                            render={({ field }: {field: FieldValues}) => (
                                <FormItem>
                                    <FormLabel>PM ends at:</FormLabel>
                                    <FormControl>
                                        <Input type="time" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="dayStart"
                            render={({ field }: {field: FieldValues}) => (
                                <FormItem>
                                    <FormLabel>When does your day start?</FormLabel>
                                    <FormControl>
                                        <Input type="time" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="dayEnd"
                            render={({ field }: {field: FieldValues}) => (
                                <FormItem>
                                    <FormLabel>When does your day end?</FormLabel>
                                    <FormControl>
                                        <Input type="time" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit">Save Preferences</Button>
                    </form>
                </Form>
        </DialogContent>
        </Dialog>
    )
}