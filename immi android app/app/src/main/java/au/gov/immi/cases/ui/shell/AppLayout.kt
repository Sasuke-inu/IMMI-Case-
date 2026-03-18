package au.gov.immi.cases.ui.shell

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import au.gov.immi.cases.navigation.ImmiNavGraph
import au.gov.immi.cases.ui.theme.DesignTokens
import kotlinx.coroutines.launch

/**
 * App Shell — overall frame with:
 * - [ModalNavigationDrawer]: side drawer for all 17+ destinations
 * - [TopAppBar]: styled with webapp primary color (#1b2838 deep blue-gray)
 * - [NavigationBar]: bottom tabs with white background (webapp: bg-card)
 * - [ImmiNavGraph]: routed page content in Scaffold body
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppLayout(
    navController: NavHostController = rememberNavController()
) {
    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    val currentBackStack by navController.currentBackStackEntryAsState()
    val currentRoute = currentBackStack?.destination?.route

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            AppDrawer(
                navController = navController,
                currentRoute = currentRoute,
                onCloseDrawer = { scope.launch { drawerState.close() } }
            )
        }
    ) {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        // Derive page title from current route
                        val title = currentBackStack?.destination?.route
                            ?.substringAfterLast(".")
                            ?.replace(Regex("/\\{[^}]+\\}|\\?.*"), "")
                            ?.replace(Regex("([A-Z])"), " $1")
                            ?.trim()
                            ?: "IMMI Cases"
                        Text(
                            text  = title,
                            style = androidx.compose.material3.MaterialTheme.typography.titleLarge,
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(
                                imageVector        = Icons.Default.Menu,
                                contentDescription = "Open navigation menu",
                            )
                        }
                    },
                    // Webapp: sidebar/topbar uses primaryDefault (#1b2838 deep blue-gray)
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor        = DesignTokens.Colors.primaryDefault,
                        titleContentColor     = Color.White,
                        navigationIconContentColor = Color.White,
                        actionIconContentColor = Color.White,
                    ),
                )
            },
            bottomBar = {
                // Webapp: nav background is bg-card (white), active items use primary/accent
                NavigationBar(
                    containerColor = DesignTokens.Colors.bgCard,
                    contentColor   = DesignTokens.Colors.textDefault,
                ) {
                    BottomNavItem.entries.forEach { item ->
                        val isSelected = BottomNavItem.fromRoute(currentRoute) == item
                        NavigationBarItem(
                            selected = isSelected,
                            onClick = {
                                navController.navigate(item.route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState    = true
                                }
                            },
                            icon = {
                                Icon(
                                    imageVector        = if (isSelected) item.selectedIcon else item.unselectedIcon,
                                    contentDescription = item.label,
                                )
                            },
                            label  = { Text(item.label) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor      = DesignTokens.Colors.primaryDefault,
                                selectedTextColor      = DesignTokens.Colors.primaryDefault,
                                unselectedIconColor    = DesignTokens.Colors.textMuted,
                                unselectedTextColor    = DesignTokens.Colors.textMuted,
                                indicatorColor         = DesignTokens.Colors.bgSurface,
                            ),
                        )
                    }
                }
            }
        ) { innerPadding ->
            ImmiNavGraph(
                navController = navController,
                modifier      = Modifier.padding(innerPadding)
            )
        }
    }
}
