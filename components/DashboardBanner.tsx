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
            image: "/banners/slide1.png?v=4",
            alt: "Bitácora de Producción - Calidad en Acción",
        },
        {
            id: 2,
            image: "/banners/slide2.png?v=4",
            alt: "Productos de Limpieza Ginez",
        },
        {
            id: 3,
            image: "/banners/slide3.png?v=4",
            alt: "Calidad Garantizada",
        },
        {
            id: 4,
            image: "/banners/slide4.png?v=4",
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
                                    <CardContent className="flex aspect-[21/9] md:aspect-[24/7] items-center justify-center p-0 relative bg-slate-100 dark:bg-slate-800">
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
