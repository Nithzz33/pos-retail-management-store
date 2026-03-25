import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ProductImageCarouselProps {
  images: string[];
  aspectRatio?: string;
  className?: string;
  showDots?: boolean;
  showArrows?: boolean;
  imageClassName?: string;
  index?: number;
  onChange?: (index: number) => void;
}

export const ProductImageCarousel: React.FC<ProductImageCarouselProps> = ({
  images,
  aspectRatio = "aspect-square",
  className = "",
  showDots = true,
  showArrows = true,
  imageClassName = "p-4",
  index,
  onChange
}) => {
  const [internalIndex, setInternalIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const currentIndex = index !== undefined ? index : internalIndex;

  if (!images || images.length === 0) return null;

  const handleIndexChange = (newIndex: number, newDirection: number) => {
    setDirection(newDirection);
    if (onChange) {
      onChange(newIndex);
    } else {
      setInternalIndex(newIndex);
    }
  };

  const nextImage = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const nextIdx = (currentIndex + 1) % images.length;
    handleIndexChange(nextIdx, 1);
  };

  const prevImage = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const prevIdx = (currentIndex - 1 + images.length) % images.length;
    handleIndexChange(prevIdx, -1);
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 300 : -300,
      opacity: 0
    })
  };

  return (
    <div className={`relative overflow-hidden ${aspectRatio} ${className} group/carousel`}>
      <AnimatePresence initial={false} custom={direction}>
        <motion.img
          key={currentIndex}
          src={images[currentIndex]}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 }
          }}
          className={`absolute inset-0 w-full h-full object-contain ${imageClassName}`}
          referrerPolicy="no-referrer"
        />
      </AnimatePresence>

      {images.length > 1 && showArrows && (
        <>
          <button
            onClick={prevImage}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm shadow-md flex items-center justify-center text-gray-800 opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-white z-10"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={nextImage}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm shadow-md flex items-center justify-center text-gray-800 opacity-0 group-hover/carousel:opacity-100 transition-opacity hover:bg-white z-10"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}

      {images.length > 1 && showDots && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleIndexChange(i, i > currentIndex ? 1 : -1);
              }}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                i === currentIndex ? 'bg-[#FF3269] w-4' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
};
