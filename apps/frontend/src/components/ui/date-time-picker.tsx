"use client";

import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface DateTimePickerProps {
  value?: string;
  onChange?: (val: string) => void;
  className?: string;
}

export function DateTimePicker({ value, onChange, className }: DateTimePickerProps) {
  // value is expected to be an ISO string or empty string
  const dateObj = value ? new Date(value) : undefined;

  const [date, setDate] = React.useState<Date | undefined>(dateObj);
  const [time, setTime] = React.useState<string>(
    dateObj
      ? `${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`
      : "12:00"
  );
  
  React.useEffect(() => {
    if (value) {
      const d = new Date(value);
      setDate(d);
      setTime(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`);
    } else {
      setDate(undefined);
    }
  }, [value]);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    updateValue(selectedDate, time);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTime(newTime);
    updateValue(date, newTime);
  };

  const updateValue = (d: Date | undefined, t: string) => {
    if (!d || !onChange) return;
    
    const [hours, minutes] = t.split(':').map(Number);
    const updated = new Date(d);
    updated.setHours(hours || 0);
    updated.setMinutes(minutes || 0);
    updated.setSeconds(0);
    updated.setMilliseconds(0);
    
    onChange(updated.toISOString());
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? (
            format(date, "PPP p", { locale: es })
          ) : (
            <span>Seleccionar fecha y hora</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateSelect}
          initialFocus
        />
        <div className="border-t border-border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Hora</span>
            <Input
              type="time"
              value={time}
              onChange={handleTimeChange}
              className="w-[120px] h-8"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
