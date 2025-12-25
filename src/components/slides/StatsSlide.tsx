import { GitStoryData } from "@/types";
import { motion, useAnimationControls } from "motion/react";
import { useEffect } from "react";
import {
    Flame,
    GitCommit,
    GitPullRequest,
    MessageSquare,
    Star,
    Users,
    AlertCircle,
    BookOpen,
    Award,
    GraduationCap
} from "lucide-react";
import { DotPattern } from "@/components/ui/dot-pattern";
import { NumberTicker } from "@/components/ui/number-ticker";
import { HyperText } from "@/components/ui/hyper-text";
import { BorderBeam } from "@/components/ui/border-beam";
import { useIsMobile } from "@/hooks/use-mobile";
import { getGitHubAchievements } from "@/services/scoringAlgorithms";

interface SlideProps {
    data: GitStoryData;
    isActive: boolean;
}

export default function StatsSlide({ data, isActive }: SlideProps) {
    const isMobile = useIsMobile();
    const containerControls = useAnimationControls();

    // Use the achievements count from GitHub profile (fetched from profile page)
    // Fallback to calculated count if profile fetch failed
    const achievementsCount = data.community.badges > 0 
        ? data.community.badges 
        : getGitHubAchievements(
            data.contributionBreakdown,
            data.community,
            data.totalCommits,
            data.longestStreak,
            data.community.publicRepos,
            (data.topRepos || []).map(repo => ({ stars: repo.stars || 0 }))
        ).length;

    useEffect(() => {
        if (isActive) {
            // Sequence: 
            // 1. Logo appears at center (1.2s pop animation)
            // 2. Stay at center briefly (0.3s) = total 1.5s
            // 3. Move to left position (0.5s) = starts at 1.5s, ends at 2.0s
            // 4. Username appears and types (1.5s) = starts at 2.0s, ends at 3.5s
            // 5. Move back to center (0.5s) = starts at 3.5s
            containerControls.start({
                x: 0,
                transition: { delay: 0, duration: 0 }
            }).then(() => {
                // Wait for logo pop animation to complete (1.2s) + brief pause (0.3s) = 1.5s
                return new Promise(resolve => setTimeout(resolve, 1500));
            }).then(() => {
                // Move to left position (0.5s animation, completes at 2.0s)
                return containerControls.start({
                    x: -40,
                    transition: { duration: 0.5, ease: "easeInOut" }
                });
            }).then(() => {
                // Wait for typing animation to complete (1.5s) before centering
                // Username delay is 2.0s, typing takes 1.5s, so total is 3.5s
                setTimeout(() => {
                    containerControls.start({
                        x: 0,
                        transition: { duration: 0.5, ease: "easeInOut" }
                    });
                }, 1500);
            });
        } else {
            containerControls.set({ x: 0 });
        }
    }, [isActive, containerControls]);

    const stats = [
        // Row 1
        {
            label: "Total Commits",
            value: data.totalCommits,
            icon: GitCommit,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20",
            className: "md:col-start-1 md:row-start-1",
            showGraph: true
        },
        // Top Center Left - Badges
        {
            label: "Total Achievements",
            value: achievementsCount,
            icon: Award,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
            border: "border-amber-500/20",
            className: "md:col-start-2 md:row-start-1 md:rounded-br-[2rem]" // Curve for circle
        },
        // Top Center Right - Grade
        {
            label: "Grade",
            value: data.grade ?? "A+",
            icon: GraduationCap,
            color: "text-violet-500",
            bg: "bg-violet-500/10",
            border: "border-violet-500/20",
            className: "md:col-start-3 md:row-start-1 md:rounded-bl-[2rem]" // Curve for circle
        },
        {
            label: "Code Reviews",
            value: data.contributionBreakdown.reviews,
            icon: MessageSquare,
            color: "text-pink-500",
            bg: "bg-pink-500/10",
            border: "border-pink-500/20",
            className: "md:col-start-4 md:row-start-1"
        },

        // Row 2 (Sides only)
        {
            label: "Issues Opened",
            value: data.contributionBreakdown.issues,
            icon: AlertCircle,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
            border: "border-blue-500/20",
            className: "md:col-start-1 md:row-start-2"
        },
        // Center space (Col 2-3) is reserved for Avatar
        {
            label: "Stars Earned",
            value: data.community.totalStars,
            icon: Star,
            color: "text-yellow-500",
            bg: "bg-yellow-500/10",
            border: "border-yellow-500/20",
            className: "md:col-start-4 md:row-start-2"
        },

        // Row 3
        {
            label: "Total Followers",
            value: data.community.followers,
            icon: Users,
            color: "text-cyan-500",
            bg: "bg-cyan-500/10",
            border: "border-cyan-500/20",
            className: "md:col-start-1 md:row-start-3"
        },
        // Bottom Center Left - Streak
        {
            label: "Longest Streak",
            value: data.longestStreak,
            suffix: " Days",
            icon: Flame,
            color: "text-orange-500",
            bg: "bg-orange-500/10",
            border: "border-orange-500/20",
            className: "md:col-start-2 md:row-start-3 md:rounded-tr-[2rem]" // Curve for circle
        },
        // Bottom Center Right - PRs
        {
            label: "Total PRs",
            value: data.contributionBreakdown.prs,
            icon: GitPullRequest,
            color: "text-purple-500",
            bg: "bg-purple-500/10",
            border: "border-purple-500/20",
            className: "md:col-start-3 md:row-start-3 md:rounded-tl-[2rem]" // Curve for circle
        },
        {
            label: "Public Repos",
            value: data.community.publicRepos,
            icon: BookOpen,
            color: "text-indigo-500",
            bg: "bg-indigo-500/10",
            border: "border-indigo-500/20",
            className: "md:col-start-4 md:row-start-3"
        }
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05,
                delayChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, scale: 0.9, y: 20 },
        show: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: {
                type: "spring" as const,
                bounce: 0.3,
                duration: 0.6
            }
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full p-4 md:p-8 bg-background text-foreground relative overflow-hidden">

            {/* Background Effects */}
            <DotPattern className="opacity-20 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]" />
            {!isMobile && (
                <>
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse" />
                    <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-secondary/10 rounded-full blur-[100px] animate-pulse delay-700" />
                </>
            )}
            {isMobile && (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
            )}

            <motion.div
                initial={{ opacity: 0, y: -30 }}
                animate={isActive ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="text-center z-10 mb-4 md:mb-8"
            >
                <h2 className="text-3xl md:text-5xl font-serif italic font-bold bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/50 tracking-tight">
                    Your Impact {!isMobile ? " at a Glance" : ""}
                </h2>
            </motion.div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                animate={isActive ? "show" : "hidden"}
                className={`
                    w-full max-w-5xl z-10 p-2 overflow-y-auto max-h-[calc(100vh-120px)] md:max-h-none no-scrollbar
                    grid grid-cols-2 md:grid-cols-4 grid-rows-5 md:grid-rows-3 gap-3
                `}
            >
                {/** Central Avatar Circle - Desktop Placement (Rows 2/3 Cols 2/3) implies center */}
                {/** We use explicit grid placement for mobile vs desktop */}

                <motion.div
                    className="
                        hidden md:flex 
                        col-start-2 col-span-2 row-start-2 row-span-1 
                        items-center justify-center relative z-20
                    "
                >
                    {/* Container that moves from center to left, then back to center */}
                    <motion.div
                        initial={{ x: 0 }}
                        animate={containerControls}
                        className="flex items-center gap-4"
                    >
                        {/* Avatar - appears first at absolute center */}
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
                            animate={isActive ? { 
                                scale: 1, 
                                opacity: 1, 
                                rotate: 0 
                            } : { 
                                scale: 0.5, 
                                opacity: 0, 
                                rotate: -10 
                            }}
                            transition={{ 
                                duration: 1.2, 
                                type: "spring", 
                                bounce: 0.5 
                            }}
                            className="flex-shrink-0"
                        >
                            {/* Avatar Container with Border Beam */}
                            <div className="relative rounded-full p-1 overflow-hidden">
                                <BorderBeam size={160} duration={8} delay={9} borderWidth={2} colorFrom="#ffaa40" colorTo="#9c40ff" />
                                <div className="relative w-40 h-40 rounded-full border-4 border-background/50 shadow-2xl overflow-hidden ring-4 ring-primary/10 z-10">
                                    <img
                                        src={data.avatarUrl}
                                        alt={data.username}
                                        className="w-full h-full object-cover"
                                    />
                                    {/* Glow effect */}
                                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent pointer-events-none" />
                                </div>
                            </div>
                        </motion.div>

                        {/* Username with typing animation - appears after logo moves left */}
                        <motion.div
                            initial={{ opacity: 0, width: 0, x: -20 }}
                            animate={isActive ? { 
                                opacity: 1, 
                                width: "auto",
                                x: 0 
                            } : { 
                                opacity: 0, 
                                width: 0,
                                x: -20 
                            }}
                            transition={{ 
                                delay: 2.0, 
                                duration: 0.5 
                            }}
                            className="flex items-center gap-2 overflow-hidden"
                        >
                            <span className="opacity-50 text-lg md:text-xl font-light whitespace-nowrap">@</span>
                            <HyperText
                                className="text-2xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600 whitespace-nowrap"
                                duration={1500}
                                delay={2.0}
                            >
                                {data.username}
                            </HyperText>
                        </motion.div>
                    </motion.div>
                </motion.div>

                {stats.map((stat) => (
                    <motion.div
                        key={stat.label}
                        variants={itemVariants}
                        className={`
                            relative overflow-hidden rounded-2xl border backdrop-blur-xl p-3 md:p-4
                            flex flex-col justify-between group transition-all duration-300 hover:scale-[1.02] hover:shadow-lg
                            ${stat.bg} ${stat.border} ${stat.className}
                            /* Reset Grid placement on mobile if needed, or rely on distinct layout */
                            col-span-1 row-span-1 /* Default for mapped items unless overridden by stat.className class */
                        `}
                    >
                        {/* Hover Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        {/* Icon & Label */}
                        <div className="flex justify-between items-start mb-1 md:mb-2 relative z-10">
                            <div className={`p-1.5 md:p-2 rounded-xl bg-background/40 backdrop-blur-md shadow-sm ring-1 ring-black/5 dark:ring-white/10 transition-transform group-hover:rotate-6`}>
                                <stat.icon className={`w-4 h-4 md:w-5 md:h-5 ${stat.color}`} />
                            </div>
                            {stat.showGraph && (
                                <div className="text-[10px] md:text-xs font-medium px-2 py-0.5 md:py-1 rounded-full bg-background/30 backdrop-blur-sm border border-white/10 text-muted-foreground">
                                    All Time
                                </div>
                            )}
                        </div>

                        {/* Value */}
                        <div className="relative z-10 mt-1 md:mt-2">
                            <div className="flex items-baseline gap-0.5 md:gap-1 flex-wrap">
                                <span className={`text-2xl md:text-3xl lg:text-4xl font-bold tracking-tighter ${stat.color} brightness-110`}>
                                    {typeof stat.value === 'number' ? (
                                        <NumberTicker value={stat.value} />
                                    ) : (
                                        stat.value
                                    )}
                                </span>
                                {stat.suffix && (
                                    <span className="text-xs md:text-sm font-medium text-muted-foreground/80 mb-0.5 md:mb-1">{stat.suffix}</span>
                                )}
                            </div>
                            <p className="text-[10px] md:text-xs font-medium text-muted-foreground/70 uppercase tracking-widest mt-0.5 md:mt-1 truncate">
                                {stat.label}
                            </p>
                        </div>

                        {/* Decorative background icon for large cards */}
                        {stat.showGraph && (
                            <stat.icon className="absolute -bottom-6 -right-6 w-32 h-32 md:w-32 md:h-32 opacity-[0.03] rotate-12" />
                        )}
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
}
