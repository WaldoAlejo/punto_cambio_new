"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PasoRequiereEmpaqueProps {
  onNext: (requiereEmpaque: boolean) => void;
}

export default function PasoRequiereEmpaque({
  onNext,
}: PasoRequiereEmpaqueProps) {
  return (
    <Card className="w-full max-w-md mx-auto mt-6">
      <CardHeader>
        <CardTitle>¿Requiere empaque y embalaje?</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Button onClick={() => onNext(true)} className="w-full">
          Sí, requerimos empaque
        </Button>
        <Button
          variant="outline"
          onClick={() => onNext(false)}
          className="w-full"
        >
          No, continuar sin empaque
        </Button>
      </CardContent>
    </Card>
  );
}
