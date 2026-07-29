"use client"

import * as React from "react"
import Autoplay from "embla-carousel-autoplay"
import { Card, CardContent } from "@/components/ui/card"
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel"
import Image from "next/image"

export function DashboardBanner() {
    const plugin = React.useRef(
        Autoplay({ delay: 4000, stopOnInteraction: false })
    )

    const slides = [
        {
            id: 1,
            image: "/banners/slide_1.webp",
            alt: "Bitácora de Producción - Calidad en Acción",
        },
        {
            id: 2,
            image: "/banners/slide_2.webp",
            alt: "Ambientadores Ginez",
        },
        {
            id: 4,
            image: "/banners/slide_4.webp",
            alt: "Calidad Garantizada",
        },
        {
            id: 5,
            image: "/banners/slide_5.webp",
            alt: "Porrones Ambientador Retorno Ginez",
        },
        {
            id: 6,
            image: "/banners/slide_6.webp",
            alt: "Porrón Colores Ginez",
        },
        {
            id: 7,
            image: "/banners/slide_7.webp",
            alt: "Soluciones Integrales",
        },
    ]

    return (
        <div className="w-full mb-8">
            <Carousel
                plugins={[plugin.current]}
                opts={{ loop: true }}
                className="w-full"
                onMouseEnter={plugin.current.stop}
                onMouseLeave={plugin.current.reset}
            >
                <CarouselContent>
                    {slides.map((slide) => (
                        <CarouselItem key={slide.id}>
                            <div className="p-1">
                                <Card className="border-none shadow-sm overflow-hidden">
                                    {/* Usamos el mismo aspect ratio para todo: 24/7 (aprox 1920x560) */}
                                    <CardContent className="flex aspect-[24/7] items-center justify-center p-0 relative bg-slate-100 dark:bg-slate-800">
                                        <Image
                                            src={slide.image}
                                            alt={slide.alt}
                                            fill
                                            className="object-cover"
                                            priority={slide.id === 1}
                                        />
                                    </CardContent>
                                </Card>
                            </div>
                        </CarouselItem>
                    ))}
                </CarouselContent>
                <CarouselPrevious className="left-4 bg-white/50 hover:bg-white/80 border-none hidden md:flex" />
                <CarouselNext className="right-4 bg-white/50 hover:bg-white/80 border-none hidden md:flex" />
            </Carousel>
        </div>
    )
}
